import { articlesLogger as logger } from '../logger.js';
import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';
import { extract } from '@extractus/article-extractor';
import { EventEmitter } from 'events';



class Articles {
    /**
     * @type {Articles | null}
     */
    static instance = null;
    articleCache = {};
    userAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    eventEmitter = new EventEmitter();
    processingQueue = false;
    requestQueue = [];

    static getInstance() {
        if (!this.instance) {
            this.instance = new Articles();
        }
        return this.instance;
    }


    /**
     * @param {string} url
     */
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




    /**
     * @param {string} htmlData
     * @param {string} url
     */
    async processArticle(htmlData, url) {
        try {
            // Log the URL being processed for reference
            //logger.log(`Processing article from URL: ${url}`);

            // Use the extract function from @extractus/article-extractor
            const article = await extract(htmlData, {
                // You can pass additional options if needed
            });

            if (article && article.content) {
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


    /**
     * @param {string} content
     */
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

    // /**
    //  * @param {string | string[]} feedIds
    //  */
    // async fetchArticlesWithContentForFeeds(feedIds) {
    //     // If a single feedId is provided, convert it to an array
    //     if (!Array.isArray(feedIds)) {
    //         feedIds = [feedIds];
    //     }

    //     const allArticlesWithContent = [];

    //     for (const feedId of feedIds) {
    //         const unreadStories = this.articleCache[feedId] || [];
    //         const validUrls = unreadStories.filter((/** @type {{ story_permalink: string; }} */ story) => typeof story.story_permalink === 'string' && story.story_permalink.startsWith('http'));

    //         // Fetch content for each valid URL and assign a UUID
    //         const articlesWithContent = await Promise.all(validUrls.map(async (/** @type {{ story_permalink: any; }} */ story) => {
    //             const articleContent = await this.fetchArticle(story.story_permalink);
    //             return {
    //                 ...articleContent,
    //                 id: uuidv4(), // Generate a UUID as the ID
    //                 feedId: feedId // Include the feedId for later reference
    //             };
    //         }));

    //         allArticlesWithContent.push(...articlesWithContent);
    //     }

    //     return allArticlesWithContent;
    // }




    /**
     * @param {{ story_permalink: any; }} story
     * @param {string} feedId
     * @param {string} feedColor
     */
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

    /**
     * @param {string} feedId
     * @param {string} feedColor
     */
    async fetchArticlesInBatches(feedId, feedColor, batchSize = 5) {
        this.requestQueue.push({ feedId, feedColor, batchSize });

        if (this.processingQueue) {
            return;
        }

        this.processingQueue = true;

        while (this.requestQueue.length > 0) {
            const nextRequest = this.requestQueue.shift();
            await this.processNextRequest(nextRequest);
        }

        this.processingQueue = false;
    }

    async processNextRequest(request) {
        const { feedId, feedColor, batchSize } = request;

        const allArticlesWithContent = [];

        const unreadStories = this.articleCache[feedId] || [];
        const validUrls = unreadStories.filter((/** @type {{ story_permalink: string; }} */ story) =>
            typeof story.story_permalink === 'string' && story.story_permalink.startsWith('http'));

        while (validUrls.length > 0) {
            const batch = validUrls.splice(0, batchSize);
            const promises = batch.map((/** @type {any} */ story) =>
                this.fetchArticleWithRetry(story, feedId, feedColor));

            const articlesWithContent = await Promise.all(promises);

            allArticlesWithContent.push(...articlesWithContent);

            this.articleCache[feedId] = allArticlesWithContent;

            this.eventEmitter.emit('articlesBatch', articlesWithContent);

            validUrls.unshift(...articlesWithContent.filter(article => article.title === '' && article.text === ''));
        }

        this.eventEmitter.emit('jobComplete');
    }


}




const articleCache = Articles.getInstance().articleCache;
const eventEmitter = Articles.getInstance().eventEmitter;

/**
 * Fetches a single article.
 * @param {string} url The URL of the article to fetch.
 * @returns The fetched article.
 */
const fetchArticle = url =>
    Articles.getInstance().fetchArticle(url);

// /**
//  * Fetches articles with content for given feed IDs.
//  * @param {string | string[]} feedIds An array of feed IDs to fetch articles for.
//  * @returns An array of articles with fetched content.
//  */
// const fetchArticlesWithContentForFeeds = feedIds =>
//     Articles.getInstance().fetchArticlesWithContentForFeeds(feedIds);

/**
 * Fetches articles in batches for a specific feed, with color and optional batch size.
 * @param {string} feedId The ID of the feed.
 * @param {string} feedColor The color associated with the feed.
 * @param {number} [batchSize=5] The batch size.
 * @returns The batch of articles with fetched content.
 */
const fetchArticlesInBatches = (feedId, feedColor, batchSize = 5) =>
    Articles.getInstance().fetchArticlesInBatches(feedId, feedColor, batchSize);


export {
    articleCache,
    eventEmitter,
    fetchArticle,
    // fetchArticlesWithContentForFeeds,
    fetchArticlesInBatches
};