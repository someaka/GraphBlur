// FeedUI.js

import { formatArticleText } from '../utils/FeedUtils.js';
import { articlesCache } from '../data/FeedCache.js';
import { feedsLogger as logger } from '../../logger.js';
import { loadArticles } from '../data/FeedData.js';
import { updateGraphForSelectedFeeds } from '../../Graph/graph.js';

const mainContentElement = document.querySelector('#maincontent');
const articlesElement = document.querySelector('#articles');

function toggleMainContent(show) {
    // Slide the panel into view if show is true, otherwise slide it out of view
    mainContentElement.style.right = show ? '0px' : '-40%';
}

function toggleFeedElement(feedElement, originalColor) {
    feedElement.classList.toggle('clicked');
    feedElement.style.backgroundColor = feedElement.classList.contains('clicked') ? originalColor + '80' : originalColor;
    feedElement.style.boxShadow = feedElement.classList.contains('clicked') ? 'inset 0 0 5px rgba(0,0,0,0.3)' : '';
}



async function displayArticles(feedData) {
    // Clear previous articles and graph
    articlesElement.innerHTML = '';

    // Check if articles are cached
    if (!articlesCache[feedData.id]) {
        await loadArticles(feedData);
    }

    // Display articles in the articles element
    const articles = articlesCache[feedData.id];

    // Check if articles is an array before calling forEach
    if (!Array.isArray(articles)) {
        logger.error(`Expected articles to be an array, but got:`, articles);
        return; // Exit the function if articles is not an array
    }

    articles.forEach(articleData => {
        const articleContainer = document.createElement('div');
        articleContainer.classList.add('article-container');

        if (articleData && articleData.article) {
            const titleElement = document.createElement('h2');
            titleElement.textContent = articleData.article.title;
            articleContainer.appendChild(titleElement);

            const textElement = document.createElement('p');
            textElement.textContent = formatArticleText(articleData.article.text);
            articleContainer.appendChild(textElement);

            articleContainer.style.backgroundColor = articleData.feedColor; // Assign the feed color to the article
        } else {
            const failedMessage = document.createElement('p');
            failedMessage.textContent = 'Failed to fetch article';
            failedMessage.style.color = 'red'; // Assign a red color to indicate failure
            articleContainer.appendChild(failedMessage);
        }
        articlesElement.appendChild(articleContainer);
    });

    updateGraphForSelectedFeeds(articlesCache); // Pass articlesCache as an argument
}

export { toggleMainContent, toggleFeedElement, displayArticles };