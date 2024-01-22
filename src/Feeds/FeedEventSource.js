// FeedEventSource.js
import { feedsLogger as logger } from '../logger.js';
import { updateArticlesUI } from './ui/FeedUI.js';
import { cacheArticle } from './data/FeedCache.js';
import { updateGraphForSelectedFeeds } from '../Graph/graph.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { articlesCache } from './data/FeedCache.js';

const baseUrl = getApiBaseUrl();

const eventSourceArticles = new EventSource(`${baseUrl}/article-updates`);
const eventSource = new EventSource(`${baseUrl}/events`);

eventSourceArticles.onmessage = (event) => {
    try {
        const article = JSON.parse(event.data);
        updateArticlesUI(article);
        cacheArticle(article);
    } catch (error) {
        logger.error('Error parsing article data:', error);
    }
};

eventSourceArticles.onerror = (error) => {
    logger.error('Error with event source for articles:', error);
};

eventSource.addEventListener('similarityPairsUpdate', (event) => {
    try {
        const similarityPairs = JSON.parse(event.data);
        // logger.log("received similarityPairsUpdate", similarityPairs);
        updateGraphForSelectedFeeds(articlesCache, similarityPairs);
    } catch (error) {
        logger.error('Error parsing similarity Pairs data:', error);
    }
});



export { eventSourceArticles, eventSource };