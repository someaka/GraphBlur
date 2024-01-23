// FeedElements.js

import { handleFeedClick } from './FeedEvents.js';
import { feedsLogger as logger } from '../../logger.js';

const feedsListElement = document.querySelector('#feedslist');

async function createFeedElement(feedData, feedIndex, totalFeeds) {
    const feedElement = document.createElement('div');
    feedElement.textContent = `${feedData.feed_title} (${feedData.nt})`;
    feedElement.id = feedData.id; // Set the id attribute to the feed's ID

    // Define the hue ranges for pastel blue and green
    const hueBlueStart = 180, hueBlueEnd = 220; // Range for pastel blues
    const hueGreenStart = 80, hueGreenEnd = 140; // Range for pastel greens

    // Calculate the number of feeds that will be assigned each color
    const totalBlueFeeds = Math.ceil(totalFeeds / 2);
    const totalGreenFeeds = Math.floor(totalFeeds / 2);

    // Calculate the step size for each range
    const stepSizeBlue = (hueBlueEnd - hueBlueStart) / totalBlueFeeds;
    const stepSizeGreen = (hueGreenEnd - hueGreenStart) / totalGreenFeeds;

    // Alternate between blue and green ranges
    const isBlue = feedIndex % 2 === 0;
    const colorIndex = Math.floor(feedIndex / 2);
    const hue = isBlue
        ? hueBlueStart + (colorIndex * stepSizeBlue) % 360
        : hueGreenStart + (colorIndex * stepSizeGreen) % 360;

    // Create a pastel color with the calculated hue
    const saturation = 60; // Saturation for pastel colors
    const lightness = 85; // Lightness for pastel colors
    const originalColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    // Apply the color to the feed element
    Object.assign(feedElement.style, {
        backgroundColor: originalColor,
        padding: '10px',
        cursor: 'pointer',
    });

    feedElement.dataset.originalColor = originalColor; // Store the original color

    feedElement.addEventListener('click', () => handleFeedClick(feedElement, feedData));

    return { feedElement, color: originalColor };
}



async function appendFeedsToDOM(feedsData) {
    try {
        const feedsFragment = document.createDocumentFragment();
        const totalFeeds = Object.keys(feedsData).length;

        for (const [feedIndex, feedData] of Object.entries(feedsData)) {
            if (feedData.nt > 0) {
                const { feedElement, color } = await createFeedElement(feedData, feedIndex, totalFeeds);
                feedData.feedColor = color; // Store the color in feedData
                feedsFragment.appendChild(feedElement);
            }
        }

        feedsListElement.appendChild(feedsFragment);
    } catch (error) {
        console.error('Error appending feeds to DOM:', error);
        // Handle the error appropriately, e.g., show an error message to the user
    }
}


export { createFeedElement, appendFeedsToDOM };