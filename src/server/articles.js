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
    eventEmitter = new EventEmitter().setMaxListeners(200);
    processingQueue = false;
    /**
     * @type {any | null}
     */
    requestQueue = null;

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
        let article = null;
        try { article = await extract(htmlData); }
        catch (error) {
            logger.error('An error occurred while extracting the article:', error);
        }
        const processedArticle = {
            title: article?.title || '',
            text: this.cleanArticleContent(article?.content) || '',
            url: url
        };
        article = null;
        return processedArticle;

    }


    /**
     * @param {string | undefined} content
     */
    cleanArticleContent(content) {
        if (content) return sanitizeHtml(content, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
            allowedAttributes: {
                ...sanitizeHtml.defaults.allowedAttributes,
                'img': ['src', 'alt']
            },
            // Do not allow any CSS styles
            allowedStyles: {}
        });

    }

    /**
     * @param {string | string[]} feedIds
     */
    async fetchArticlesWithContentForFeeds(feedIds) {
        if (!Array.isArray(feedIds)) {
            feedIds = [feedIds];
        }

        const allArticlesWithContent = [];

        for (const feedId of feedIds) {
            const validUrls = this.articleCache[feedId]
                .filter((/** @type {{ story_permalink: string; }} */ story) =>
                    typeof story.story_permalink === 'string' &&
                    story.story_permalink.startsWith('http'));

            const articlesWithContent =
                await Promise.all(
                    validUrls.map(async (/** @type {{ story_permalink: any; }} */ story) => {
                        const articleContent = await this.fetchArticle(story.story_permalink);
                        return {
                            ...articleContent,
                            id: uuidv4(),
                            feedId: feedId
                        };
                    })
                );

            allArticlesWithContent.push(...articlesWithContent);
        }

        return allArticlesWithContent;
    }




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
        if (!this.requestQueue) {
            this.requestQueue = [];
        }
        this.requestQueue.push({ feedId, feedColor, batchSize });

        if (this.processingQueue) {
            return;
        }

        this.processingQueue = true;

        while (this.requestQueue.length > 0) {
            await this.processNextRequest(this.requestQueue.shift());
        }
        this.requestQueue = null;
        this.processingQueue = false;
    }

    async processNextRequest(request) {
        const { feedId, feedColor, batchSize } = request;

        let validUrls = this.articleCache[feedId]
            .filter((/** @type {{ story_permalink: string; }} */ story) =>
                typeof story.story_permalink === 'string' && story.story_permalink.startsWith('http'));

        while (validUrls.length > 0) {
            const batch = validUrls.splice(0, batchSize);
            const articlesWithContent = await Promise.all(batch.map((/** @type {any} */ story) =>
                this.fetchArticleWithRetry(story, feedId, feedColor)));
            this.articleCache[feedId].push(...articlesWithContent);
            this.eventEmitter.emit('articlesBatch', articlesWithContent);
            validUrls.unshift(...articlesWithContent.filter(article => article.title === '' && article.text === ''));
        }

        validUrls = null;
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

/**
 * Fetches articles with content for given feed IDs.
 * @param {string | string[]} feedIds An array of feed IDs to fetch articles for.
 * @returns An array of articles with fetched content.
 */
const fetchArticlesWithContentForFeeds = feedIds =>
    Articles.getInstance().fetchArticlesWithContentForFeeds(feedIds);

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
    fetchArticlesWithContentForFeeds,
    fetchArticlesInBatches
};