// FeedEventSource.js
import { feedsLogger as logger } from '../logger.js';

import { updateArticlesUI } from './ui/FeedUI.js';
import { cacheArticle } from './data/FeedCache.js';
import { updateGraphForSelectedFeeds } from '../Graph/graph.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

const baseUrl = getApiBaseUrl();

const eventSourceArticles = new EventSource(`${baseUrl}/article-updates`);
const eventSource = new EventSource(`${baseUrl}/events`);

eventSourceArticles.onmessage = (event) => {
    const article = JSON.parse(event.data);
    updateArticlesUI(article);
    cacheArticle(article);
};
eventSource.addEventListener('similarityMatrixUpdate', (event) => {
    const similarityMatrix = JSON.parse(event.data);
    updateGraphForSelectedFeeds(articlesCache, similarityMatrix);
});

export { eventSourceArticles, eventSource };