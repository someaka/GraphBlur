// FeedEventSource.js

import { updateArticlesUI } from './ui/FeedUI.js';
import { cacheArticle } from './data/FeedCache.js';
import { updateGraphForSelectedFeeds } from '../Graph/graph.js';
import { feedsLogger as logger } from '../logger.js';

const eventSourceArticles = new EventSource('/api/article-updates');
const eventSource = new EventSource('/api/events');

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