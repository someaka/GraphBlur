import { articlesLogger as logger } from '../logger.js';
import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';
import { extract } from '@extractus/article-extractor';
import { EventEmitter } from 'events';



class Articles {
    static instance = null;
    articleCache = {};
    userAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    eventEmitter = new EventEmitter();

    static getInstance() {
        if (!Articles.instance) {
            Articles.instance = new Articles();
        }
        return Articles.instance;
    }

    async fetchArticle(url) {
        if (typeof url !== 'string') {
            logger.error(`Invalid URL: ${url}`);
            return { article: null, status: 'failure', error: 'Invalid URL' };
        }
        try {
            logger.log(`Fetching article: ${url}`);
            const response = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 5000 // Timeout after 5 seconds
            });
            logger.log(`Successfully fetched article: ${url}`);
            return { article: await this.processArticle(response.data, url), status: 'success' };
        } catch (error) {
            logger.error(`Error fetching article: ${url}, Error: ${error.message}`);
            return { article: null, status: 'failure', error: error.message };
        }
    }




    async processArticle(htmlData, url) {
        try {
            // Log the URL being processed for reference
            //logger.log(`Processing article from URL: ${url}`);

            // Use the extract function from @extractus/article-extractor
            const article = await extract(htmlData, {
                // You can pass additional options if needed
            });

            if (article) {
                // Clean the content
                const cleanedContent = this.cleanArticleContent(article.content);

                // Log the extracted article title for reference
                //logger.log(`Extracted article title: ${article.title}`);
                return {
                    title: article.title,
                    text: cleanedContent, // Use the cleaned content
                    url: article.url
                };
            } else {
                logger.error('Failed to extract article content. No article data returned.');
                // Return an object with empty strings for title and text
                return {
                    title: '',
                    text: '',
                    url: url // Keep the original URL
                };
            }
        } catch (error) {
            logger.error('An error occurred while extracting the article:', error);
            // Return an object with empty strings for title and text
            return {
                title: '',
                text: '',
                url: url // Keep the original URL
            };
        }
    }


    cleanArticleContent(content) {
        // Define the allowed tags and attributes
        const clean = sanitizeHtml(content, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
            allowedAttributes: {
                ...sanitizeHtml.defaults.allowedAttributes,
                'img': ['src', 'alt']
            },
            // Do not allow any CSS styles
            allowedStyles: {}
        });

        return clean; // Return the cleaned content
    }

    async fetchArticlesWithContentForFeeds(feedIds) {
        // If a single feedId is provided, convert it to an array
        if (!Array.isArray(feedIds)) {
            feedIds = [feedIds];
        }

        const allArticlesWithContent = [];

        for (const feedId of feedIds) {
            const unreadStories = this.articleCache[feedId] || [];
            const validUrls = unreadStories.filter(story => typeof story.story_permalink === 'string' && story.story_permalink.startsWith('http'));

            // Fetch content for each valid URL and assign a UUID
            const articlesWithContent = await Promise.all(validUrls.map(async story => {
                const articleContent = await this.fetchArticle(story.story_permalink);
                return {
                    ...articleContent,
                    id: uuidv4(), // Generate a UUID as the ID
                    feedId: feedId // Include the feedId for later reference
                };
            }));

            allArticlesWithContent.push(...articlesWithContent);
        }

        return allArticlesWithContent;
    }




    async fetchArticleWithRetry(story, feedId, feedColor) {
        try {
            const articleContent = await this.fetchArticle(story.story_permalink);
            return {
                ...articleContent,
                id: uuidv4(), // Generate a UUID as the ID
                feedId: feedId, // Include the feedId for later reference
                feedColor: feedColor
            };
        } catch (error) {
            logger.error(`Failed to fetch article: ${story.story_permalink}`);
            return {
                title: '',
                text: '',
                url: story.story_permalink,
                id: uuidv4(),
                feedId: feedId,
                feedColor: feedColor
            };
        }
    }
    
    async fetchArticlesInBatches(feedId, feedColor, batchSize = 5) {
        let allArticlesWithContent = [];
    
        const unreadStories = this.articleCache[feedId] || [];
        const validUrls = unreadStories.filter(story => typeof story.story_permalink === 'string' && story.story_permalink.startsWith('http'));
    
        while (validUrls.length > 0) {
            const batch = validUrls.splice(0, batchSize);
            const promises = batch.map(story => this.fetchArticleWithRetry(story, feedId, feedColor));
    
            const articlesWithContent = await Promise.all(promises);
    
            // Emit an 'articlesBatch' event after fetching each batch of articles
            this.eventEmitter.emit('articlesBatch', articlesWithContent);
    
            allArticlesWithContent = allArticlesWithContent.concat(articlesWithContent);
    
            // Move failed articles back to the front of the queue
            validUrls.unshift(...articlesWithContent.filter(article => article.title === '' && article.text === ''));
        }
    
        this.articleCache[feedId] = allArticlesWithContent;
    }



}


const articleCache = Articles.getInstance().articleCache;
const eventEmitter = Articles.getInstance().eventEmitter;
const fetchArticle = (...args) => Articles.getInstance().fetchArticle(...args);
const fetchArticlesWithContentForFeeds = (...args) => Articles.getInstance().fetchArticlesWithContentForFeeds(...args);
const fetchArticlesInBatches = (...args) => Articles.getInstance().fetchArticlesInBatches(...args);

export {
    articleCache,
    eventEmitter,
    fetchArticle,
    fetchArticlesWithContentForFeeds,
    fetchArticlesInBatches
};