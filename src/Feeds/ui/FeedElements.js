// @ts-nocheck
// eslint-disable-next-line no-unused-vars
import { feedsLogger as logger } from '../../logger.js';
import { handleFeedClick } from './FeedEvents.js';

const feedsListElement = document.querySelector('#feedslist');

function createFeedElement(feedData) {
    return new Promise((resolve) => {
        const feedElement = document.createElement('div'); // Use div for flexibility
        feedElement.className = 'feed-element'; // Class for styling
        feedElement.id = feedData.id; // Set the id attribute to the feed's ID
        feedElement.setAttribute('role', 'button');
        feedElement.tabIndex = 0;

        // Create a span for the feed title
        const feedTitleSpan = document.createElement('span');
        feedTitleSpan.textContent = feedData.feed_title;
        feedTitleSpan.style.position = 'relative';
        feedTitleSpan.style.zIndex = 1; // Set a higher z-index than the ::after pseudo-element

        // Create a span for the article count
        const articleCountSpan = document.createElement('span');
        articleCountSpan.className = 'article-count';
        articleCountSpan.textContent = `${feedData.nt}`;


        // Append the feed title and article count spans to the feed element
        feedElement.appendChild(feedTitleSpan);
        feedElement.appendChild(articleCountSpan);

        // Apply the color to the feed element
        Object.assign(feedElement.style, {
            backgroundColor: feedData.color,
            padding: '10px',
            cursor: 'pointer',
            borderRadius: '5px', // Rounded corners for a more modern look
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', // Subtle shadow for depth
            marginBottom: '1px', // Space between feed elements
            fontSize: '16px', // Larger font size for readability
            fontWeight: 'normal', // Normal weight for readability
            display: 'flex', // Use flexbox for alignment
            justifyContent: 'space-between', // Space out the title and count
            alignItems: 'center', // Vertical alignment
        });

        feedElement.dataset.originalColor = feedData.color; // Store the original color

        feedElement.addEventListener('click', () => handleFeedClick(feedElement, feedData));

        resolve({ feedElement, color: feedData.color });
    });
}




document.addEventListener('DOMContentLoaded', () => {
    const glow = document.getElementById('glow');

    document.body.addEventListener('mousemove', (event) => {
        const x = event.clientX;
        const y = event.clientY;

        glow.style.left = `${x - glow.offsetWidth / 2}px`;
        glow.style.top = `${y - glow.offsetHeight / 2}px`;
        glow.style.transform = 'scale(1)';
    });

    document.body.addEventListener('mouseout', () => {
        glow.style.transform = 'scale(0)';
    });
});






async function appendFeedsToDOM(feedsData) {
    try {
        const feedsFragment = document.createDocumentFragment();
        for (const [, feedData] of Object.entries(feedsData)) {
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