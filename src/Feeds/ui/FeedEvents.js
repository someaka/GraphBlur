import { toggleFeedElement, displayArticles } from './FeedUI.js';
import { updateGraphForSelectedFeeds } from '../../Graph/graph.js';
import { feedsLogger as logger } from '../../logger.js';
import { updateFeedElementStyles } from '../../domUtils.js';
import { clearGraph } from '../../Graph/graphologySigma.js';
import {
    isCurrentDisplayedFeed,
    isSelectedButNotDisplayed,
    unselectCurrentFeed,
    expandMainContent,
    retractMainContent
} from '../data/FeedState.js';




class FeedEvents {
    /**
     * @type {FeedEvents | null}
     */
    static instance = null;
    selectAllButton = document.querySelector('#selectAllButton');

    static getInstance() {
        if (!FeedEvents.instance) {
            FeedEvents.instance = new FeedEvents();
        }
        return FeedEvents.instance;
    }



    async selectAllFeedsActions(allFeeds, feedsData) {

        for (const feedElement of allFeeds) {
            const feedId = feedElement.id;
            const feedData = feedsData[feedId];
            if (!feedData || !Array.isArray(feedData.unreadStories)) {
                logger.error(`Feed data for ID ${feedId} is missing unreadStories or is not an array.`);
                continue;
            }
            await displayArticles(feedData);
        }

        updateGraphForSelectedFeeds();
    }

    unselectAllFeedsActions() {
        clearGraph();
        retractMainContent();
    }

    async toggleAllFeeds(feedsData) {
        const allFeeds = document.querySelectorAll('#feedslist div');
        if(!this.selectAllButton){
            return;
        }

        const isSelecting = this.selectAllButton.textContent === 'Select All';

        allFeeds.forEach(feed => updateFeedElementStyles(feed, isSelecting));

        this.selectAllButton.textContent = isSelecting ? 'Unselect All' : 'Select All';

        if (isSelecting) {
            // Perform actions for selecting all feeds
            await this.selectAllFeedsActions(allFeeds, feedsData);
        } else {
            // Perform actions for unselecting all feeds
            this.unselectAllFeedsActions();
        }
    }

    async handleNewFeedSelection(feedElement, feedData) {
        unselectCurrentFeed();
        logger.log('Selecting new feed and displaying its articles');
        expandMainContent(feedData);
        toggleFeedElement(feedElement, feedElement.dataset.originalColor);
        await displayArticles(feedData);
        updateGraphForSelectedFeeds(); // Pass articlesCache as an argument
    }

    handleCurrentDisplayedFeedClick(feedElement) {
        logger.log('Currently displayed feed clicked, retracting main content');
        retractMainContent();
        toggleFeedElement(feedElement, feedElement.dataset.originalColor);
        updateGraphForSelectedFeeds(); // Pass articlesCache as an argument
    }


    handleSelectedButNotDisplayedFeedClick(feedElement) {
        logger.log('Feed is selected but not the displayed feed, unselecting');
        toggleFeedElement(feedElement, feedElement.dataset.originalColor);
        updateGraphForSelectedFeeds(); // Pass articlesCache as an argument
    }

    async handleFeedClick(feedElement, feedData) {

        if (isCurrentDisplayedFeed(feedData)) {
            this.handleCurrentDisplayedFeedClick(feedElement);
            return;
        }

        if (isSelectedButNotDisplayed(feedElement)) {
            this.handleSelectedButNotDisplayedFeedClick(feedElement);
            return;
        }

        this.handleNewFeedSelection(feedElement, feedData);

    }


}

// Wrapper functions
const toggleAllFeeds = (...args) => FeedEvents.getInstance().toggleAllFeeds(...args);
const handleFeedClick = (...args) => FeedEvents.getInstance().handleFeedClick(...args);


export { toggleAllFeeds, handleFeedClick };