// FeedEvents.js

import { toggleFeedElement, displayArticles } from './FeedUI.js';
import { updateGraphForSelectedFeeds } from '../../Graph/graph.js';
import { isCurrentDisplayedFeed, unselectCurrentFeed, expandMainContent, retractMainContent } from '../data/FeedState.js';
import { clearCache, articlesCache } from '../data/FeedCache.js';
import { feedsLogger as logger } from '../../logger.js';
import { updateFeedElementStyles } from '../../domUtils.js';
import { clearGraph } from '../../Graph/visualizeGraph.js';

async function selectAllFeedsActions(allFeeds, feedsData) {
    for (const feedElement of allFeeds) {
        const feedId = feedElement.id;
        const feedData = feedsData[feedId];
        if (!feedData || !Array.isArray(feedData.unreadStories)) {
            logger.error(`Feed data for ID ${feedId} is missing unreadStories or is not an array.`);
            continue;
        }
        await displayArticles(feedData);
    }
    updateGraphForSelectedFeeds(articlesCache);
}

function unselectAllFeedsActions() {
    clearGraph();
    retractMainContent();
    clearCache();
}

async function toggleAllFeeds(feedsData) {
    const allFeeds = document.querySelectorAll('#feedslist div');
    const isSelecting = selectAllButton.textContent === 'Select All';

    allFeeds.forEach(feed => updateFeedElementStyles(feed, isSelecting));

    selectAllButton.textContent = isSelecting ? 'Unselect All' : 'Select All';

    if (isSelecting) {
        // Perform actions for selecting all feeds
        await selectAllFeedsActions(allFeeds, feedsData);
    } else {
        // Perform actions for unselecting all feeds
        unselectAllFeedsActions();
    }
}

async function handleFeedClick(feedElement, feedData) {
    // logger.log('Feed clicked:', feedData);

    if (isCurrentDisplayedFeed(feedData)) {
        handleCurrentDisplayedFeedClick(feedElement);
        return;
    }

    if (isSelectedButNotDisplayed(feedElement)) {
        handleSelectedButNotDisplayedFeedClick(feedElement);
        return;
    }

    handleNewFeedSelection(feedElement, feedData);
}

function isSelectedButNotDisplayed(feedElement) {
    return feedElement.classList.contains('clicked');
}

function handleCurrentDisplayedFeedClick(feedElement) {
    logger.log('Currently displayed feed clicked, retracting main content');
    retractMainContent();
    toggleFeedElement(feedElement, feedElement.dataset.originalColor);
    updateGraphForSelectedFeeds(articlesCache); // Pass articlesCache as an argument
}


function handleSelectedButNotDisplayedFeedClick(feedElement) {
    logger.log('Feed is selected but not the displayed feed, unselecting');
    toggleFeedElement(feedElement, feedElement.dataset.originalColor);
    updateGraphForSelectedFeeds(articlesCache); // Pass articlesCache as an argument
}

async function handleNewFeedSelection(feedElement, feedData) {
    unselectCurrentFeed();
    logger.log('Selecting new feed and displaying its articles');
    expandMainContent(feedData);
    toggleFeedElement(feedElement, feedElement.dataset.originalColor);
    await displayArticles(feedData);
    updateGraphForSelectedFeeds(articlesCache); // Pass articlesCache as an argument
}



export { toggleAllFeeds, handleFeedClick, handleCurrentDisplayedFeedClick, handleSelectedButNotDisplayedFeedClick, handleNewFeedSelection };