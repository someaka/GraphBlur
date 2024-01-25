import { feedsLogger as logger } from '../logger.js';
import { updateGraphForSelectedFeeds } from '../Graph/graph.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { articlesCache, cacheArticle } from './data/FeedCache.js';
import { createAndDisplayArticle } from './ui/FeedUI.js';

const baseUrl = getApiBaseUrl();

const ARTICLES_BATCH_EVENT = `${baseUrl}/batch-articles`;
const EVENTSOURCE_URL = `${baseUrl}/fetch-articles`;

function setupEventSource() {
    const eventSource = new EventSource(`${baseUrl}/events`);

    eventSource.onerror = (error) => {
        logger.error('Error while connecting to EventSource:', error);
    };

    return eventSource;
}

export const eventSource = setupEventSource();

eventSource.addEventListener('similarityPairsUpdate', (event) => {
    try {
        const similarityPairs = JSON.parse(event.data);
        updateGraphForSelectedFeeds( similarityPairs);
    } catch (error) {
        logger.error('Error parsing similarity Pairs data:', error);
    }
});


function waitForEventSourceClose(eventSource, feedId) {
    return new Promise((resolve) => {
        eventSource.onclose = () => {
            resolve(articlesCache[feedId]);
        };
    });
}


async function loadArticlesFromEventSource(feedId, selectedFeedIdsParam) {

    logger.log("Loading articles with feedId:", feedId, "and selectedFeedIds:", selectedFeedIdsParam);

    // Send a POST request to /fetch-articles with feedId and selectedFeedIds
    const response = await fetch(`${EVENTSOURCE_URL}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ feedId, selectedFeedIds: selectedFeedIdsParam })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    logger.log("parsed response:", response);

    // Create a new EventSource for /batch-articles
    const eventSource = new EventSource(ARTICLES_BATCH_EVENT);

    eventSource.onmessage = (event) => {
        logger.log('Received Message:', event);
    };


    eventSource.addEventListener('articlesBatch', async (event) => {
        // logger.log('Received event:', event);
        const batch = JSON.parse(event.data).articles;
        //logger.log('batch is an array:', Array.isArray(batch));

        batch.forEach(article => {
            cacheArticle(article);
            createAndDisplayArticle(article);
        });

        updateGraphForSelectedFeeds();

        // logger.log("Articles received by client:", batch);

        // Hide the spinner in the main content
        // eslint-disable-next-line no-undef
        mainContentSpinner.style.display = 'none';
    });


    eventSource.onerror = (error) => {
        logger.error('Error while loading articles:', error);
        logger.error(`EventSource readyState: ${eventSource.readyState}`);
        logger.error(`EventSource URL: ${eventSource.url}`);
        eventSource.close();
    };

    logger.log("eventSource:", eventSource);

    return waitForEventSourceClose(eventSource, feedId);
}

export {
    loadArticlesFromEventSource
};