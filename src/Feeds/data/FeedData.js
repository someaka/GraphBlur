// FeedData.js

import axios from 'axios';
import { feedsLogger as logger } from '../../logger.js';
import { articlesCache } from './FeedCache.js';

async function fetchFeeds() {
    try {
        const sessionCookie = localStorage.getItem('sessionid');
        const headers = sessionCookie ? { 'Cookie': `sessionid=${sessionCookie}` } : {};
        const response = await fetch('/api/feeds', {
            method: 'GET',
            headers: headers,
            credentials: 'include' // This will include cookies with the request
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();

        try {
            const json = JSON.parse(data);
            return json;
        } catch (e) {
            logger.error('Failed to parse JSON:', e);
            return null;
        }
    } catch (error) {
        logger.error('Failed to fetch feeds:', error);
        return null;
    }
}



async function fetchHtmlResults(feedId) {
    logger.log(`Fetching articles for feedId: ${feedId}`);

    // Get all feed elements and filter the ones that have the 'clicked' class
    const selectedFeedElements = document.querySelectorAll('#feedslist div.clicked');
    // Extract the IDs of the selected feeds
    const selectedFeedIds = Array.from(selectedFeedElements).map(feedEl => feedEl.id);

    try {
        const response = await axios.post('/api/fetch-articles', {
            feedId,
            selectedFeedIds // Include the selected feed IDs in the request body
        });
        // logger.log('Response from fetch-articles:', response.data); // Log the server response
        if (response.data.warning) {
            logger.warn('Warning from fetch-articles:', response.data.warning);
        }
        if (response.data && Array.isArray(response.data.articles)) {
            return response.data.articles; // Return the articles array
        } else {
            logger.error('fetchHtmlResults did not return an array:', response.data);
            return []; // Return an empty array if the response is not as expected
        }
    } catch (error) {
        logger.error('Failed to fetch articles:', error);
        return []; // Return an empty array in case of an error
    }
}



async function updateArticlesWithColor(articles, feedColor) {
    return articles.map(article => ({ ...article, feedColor }));
}


async function loadArticles(feedData) {
    const { id: feedId, nt: expectedArticlesCount, unreadStories, feedColor } = feedData;

    logger.log(`Loading articles for feed ${feedId}`);

    // Return cached articles if available
    if (articlesCache[feedId]) {
        return articlesCache[feedId];
    }

    mainContentSpinner.style.display = 'block'; // Show the spinner in the main content

    // const articleUrls = unreadStories.map(story => story.url);
    const fetchedArticles = await fetchHtmlResults(feedId);

    // Hide the spinner in the main content
    mainContentSpinner.style.display = 'none';

    if (!Array.isArray(fetchedArticles)) {
        logger.error('No articles fetched for feed:', feedId);
        return (articlesCache[feedId] = []); // Cache and return an empty array if no articles are fetched
    }

    if (fetchedArticles.length !== expectedArticlesCount) {
        logger.warn(`Expected ${expectedArticlesCount} articles for feed ${feedId}, but got ${fetchedArticles.length}`);
    }

    // Update articles with feed color and cache the result
    const articlesWithColor = await updateArticlesWithColor(fetchedArticles, feedColor);
    articlesCache[feedId] = articlesWithColor;

    return articlesWithColor;
}

export { fetchFeeds, fetchHtmlResults, updateArticlesWithColor, loadArticles };