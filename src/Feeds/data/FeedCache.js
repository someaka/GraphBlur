// FeedCache.js

let articlesCache = {};

function cacheArticle(article) {
    const feedId = article.feedId;
    if (!articlesCache[feedId]) {
        articlesCache[feedId] = [];
    }
    // Check if the article is already in the cache to avoid duplicates
    const existingArticleIndex = articlesCache[feedId].findIndex(cachedArticle => cachedArticle.id === article.id);
    if (existingArticleIndex === -1) {
        articlesCache[feedId].push({
            id: article.id,
            title: article.title,
            content: article.content,
            feedColor: article.feedColor
        });
    }
}

function clearCache() {
    articlesCache = {};
}

export {
    articlesCache,
    cacheArticle,
    clearCache
};