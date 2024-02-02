import { feedsLogger as logger } from '../logger.js';
import { updateGraphForSelectedFeeds } from '../Graph/graph.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { cacheArticle } from './data/FeedCache.js';
import { createAndDisplayArticle } from './ui/FeedUI.js';
import { inflateSync } from 'fflate';


const baseUrl = getApiBaseUrl();

const ARTICLES_BATCH_EVENT = `${baseUrl}/batch-articles`;
const FETCHARTICLES_URL = `${baseUrl}/fetch-articles`;
const EVENTS_URL = `${baseUrl}/events`;




function setupSimilarityPairsUpdate() {
    const eventSource = new EventSource(EVENTS_URL);

    eventSource.addEventListener('similarityPairsUpdate', onSimilarityPairsUpdate);

    eventSource.onerror = (error) => {
        logger.error('Error while connecting to EventSource:', error);
    };

    return eventSource;
}

function onSimilarityPairsUpdate(event) {
    try {
        if (event.data) {
            const base64Data = event.data;
            const binaryString = atob(base64Data);
            const data = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                data[i] = binaryString.charCodeAt(i);
            }
            if (data.length > 0) {
                const decompressedData = inflateSync(data);
                const similarityPairs = uint8ArrayToMap(decompressedData);
                updateGraphForSelectedFeeds(similarityPairs);
            }
        }
    } catch (error) {
        logger.error('Error parsing similarity Pairs data:', error);
    }
}

function uint8ArrayToMap(uint8Array) {
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(uint8Array);
    return new Map(JSON.parse(jsonStr));
}


setupSimilarityPairsUpdate();










async function setupBatchEventSource() {
    const eventSource = new EventSource(ARTICLES_BATCH_EVENT);

    eventSource.onmessage = (event) => {
        logger.log('Received Message:', event);
    };

    eventSource.addEventListener('articlesBatch', handleArticlesBatch);

    eventSource.onerror = (error) => {
        logger.error('Error while loading articles:', error);
        logger.error(`EventSource readyState: ${eventSource.readyState}`);
        logger.error(`EventSource URL: ${eventSource.url}`);
        eventSource.close();
    };

}

function handleArticlesBatch(event) {
    const batch = JSON.parse(event.data).articles;

    batch.forEach((/** @type {any} */ article) => {
        cacheArticle(article);
        createAndDisplayArticle(article);
    });

    updateGraphForSelectedFeeds();

    // Hide the spinner in the main content
    // @ts-ignore
    // eslint-disable-next-line no-undef
    mainContentSpinner.style.display = 'none';
}


setupBatchEventSource();






/**
 * @param {string} feedId
 * @param {string[]} selectedFeedIdsParam
 */
async function sendPostRequest(feedId, selectedFeedIdsParam) {
    const response = await fetch(`${FETCHARTICLES_URL}`, {
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

    return response;
}

/**
 * @param {string} feedId
 * @param {string[]} selectedFeedIdsParam
 */
async function loadArticlesFromEventSource(feedId, selectedFeedIdsParam) {
    logger.log("Loading articles with feedId:", feedId, "and selectedFeedIds:", selectedFeedIdsParam);
    try {
        const response = await sendPostRequest(feedId, selectedFeedIdsParam);
        logger.log("response:", response);
    } catch (error) {
        logger.error('Failed to load articles:', error);
    }

}

export {
    loadArticlesFromEventSource
};