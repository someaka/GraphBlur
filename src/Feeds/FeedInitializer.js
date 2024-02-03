// @ts-nocheck
import { appendFeedsToDOM } from './ui/FeedElements.js';
import { toggleAllFeeds } from './ui/FeedEvents.js';
import { feedsLogger as logger } from '../logger.js';
import { fetchFeeds } from './data/FeedData.js';
import { retractMainContent } from './data/FeedState.js';

const loadingElement = document.querySelector('#loading');
const mainContentElement = document.querySelector('#maincontent');
const selectAllButton = document.querySelector('#selectAllButton');
const toggleButton = document.querySelector('#toggleButton');

toggleButton.onclick = async () => {
    retractMainContent();
};


function isCachedDataValid(cachedData) {
    const validityPeriod = 1; // articles won't display if we use the cache for some reason TODO gotta fix that
    return cachedData && new Date().getTime() - cachedData.timestamp < validityPeriod;
}

async function initializeFeedsDisplay() {
    loadingElement.style.display = 'block';
    mainContentElement.style.right = '-40%';

    const cachedFeedsData = JSON.parse(localStorage.getItem('feedsData'));
    let localFeedsData = cachedFeedsData && isCachedDataValid(cachedFeedsData) ? cachedFeedsData.feeds : null;

    if (!localFeedsData) {
        try {
            localFeedsData = await fetchFeeds();
            if (localFeedsData) {
                const feedsDataToCache = { feeds: localFeedsData, timestamp: new Date().getTime() };
                localStorage.setItem('feedsData', JSON.stringify(feedsDataToCache));
            } else {
                throw new Error('No feeds data received');
            }
        } catch (error) {
            logger.error('Failed to fetch feeds:', error);
        }
    }

    if (localFeedsData) {
        await appendFeedsToDOM(localFeedsData);
        selectAllButton.style.display = 'block';
        selectAllButton.onclick = () => toggleAllFeeds(localFeedsData);
    }

    loadingElement.style.display = 'none';
}


export { initializeFeedsDisplay };