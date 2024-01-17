// FeedUI.js

import { formatArticleText } from '../utils/FeedUtils.js';
import { articlesCache } from '../data/FeedCache.js';
import { feedsLogger as logger } from '../../logger.js';
import { loadArticles } from '../data/FeedData.js';

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

}



const articleTemplate = document.querySelector('#articleTemplate');

function updateArticlesUI(article) {
    // Check if an article container for this UUID already exists
    const articleElement = articlesElement.querySelector(`.article[data-id="${article.id}"]`);
    if (articleElement) {
        // Article already exists, update its content
        const contentElement = articleElement.querySelector('.content');
        if (contentElement) contentElement.innerHTML = article.content;
    } else {
        // Article is new, use the template to create a new element and append it to the list of articles
        const articleTemplateClone = articleTemplate.content.cloneNode(true);
        const newArticleElement = articleTemplateClone.querySelector('.article');
        newArticleElement.dataset.id = article.id; // Set the data-id attribute to the article's UUID

        const titleElement = newArticleElement.querySelector('.title');
        const textElement = newArticleElement.querySelector('.text');
        titleElement.textContent = article.title;
        textElement.innerHTML = article.content;

        articlesElement.appendChild(newArticleElement);
    }
}


export { 
    toggleMainContent, 
    toggleFeedElement, 
    displayArticles,
    updateArticlesUI
};