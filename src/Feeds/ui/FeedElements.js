// eslint-disable-next-line no-unused-vars
import { feedsLogger as logger } from '../../logger.js';
import { handleFeedClick } from './FeedEvents.js';

const feedsListElement = document.querySelector('#feedslist');

async function createFeedElement(feedData) {
    const feedElement = document.createElement('div');
    feedElement.textContent = `${feedData.feed_title} (${feedData.nt})`;
    feedElement.id = feedData.id; // Set the id attribute to the feed's ID

    // Apply the color to the feed element
    Object.assign(feedElement.style, {
        backgroundColor: feedData.color,
        padding: '10px',
        cursor: 'pointer',
    });

    feedElement.dataset.originalColor = feedData.color; // Store the original color

    feedElement.addEventListener('click', () => handleFeedClick(feedElement, feedData));

    return { feedElement, color: feedData.color };
}



async function appendFeedsToDOM(feedsData) {
    try {
        const feedsFragment = document.createDocumentFragment();
        for (const [ , feedData] of Object.entries(feedsData)) {
            if (feedData.nt > 0) {
                const { feedElement } = await createFeedElement(feedData);
                feedsFragment.appendChild(feedElement);
            }
        }

        feedsListElement.appendChild(feedsFragment);
    } catch (error) {
        console.error('Error appending feeds to DOM:', error);
    }
}


export { createFeedElement, appendFeedsToDOM };