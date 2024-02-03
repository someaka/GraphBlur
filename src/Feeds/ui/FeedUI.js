// @ts-nocheck
import { formatArticleText } from '../utils/FeedUtils.js';
import { articlesCache } from '../data/FeedCache.js';
import { feedsLogger as logger } from '../../logger.js';
import { loadArticles } from '../data/FeedData.js';

var mainContentElement = document.querySelector('#maincontent');
var graphContentElement = document.querySelector('#graphcontent');
var articlesElement = document.querySelector('#articles');

function toggleMainContent(show) {
    // Get the main content element
    //var mainContentElement = document.querySelector('#maincontent');

    // If show is true, set the right property to 0 to show the panel,
    // otherwise set the right property to a negative value equal to the panel's width to hide the panel
    if (show) {
        mainContentElement.style.right = '0%';
        graphContentElement.style.width = 'calc(100% - 280px - 40%)'; // Subtract the width of #feedsContainer and #maincontent
    } else {
        mainContentElement.style.right = '-40%';
        graphContentElement.style.width = 'calc(100% - 280px)'; // Full width minus #feedsContainer
    }
}

function toggleFeedElement(feedElement, originalColor) {
    feedElement.classList.toggle('clicked');
    feedElement.style.backgroundColor = feedElement.classList.contains('clicked') ? originalColor + '80' : originalColor;
    feedElement.style.boxShadow = feedElement.classList.contains('clicked') ? 'inset 0 0 5px rgba(0,0,0,0.3)' : '';
}

function pointArticleFromNode(color, articleId) {
    // Find the feed that contains the articleId
    let feedId = {};

    for (let feed in articlesCache) {
        let articles = articlesCache[feed];
        for (let article of articles) {
            if (article.id === articleId) {
                feedId.id = feed;
            }
        }
    }

    if (feedId.id) {

        displayArticles(feedId).then(() => {
            // Scroll to the article after a slight delay to allow for DOM rendering
            setTimeout(() => {
                // Use the article ID to find the article element
                const articleElement = document.getElementById(`article-${articleId}`);
                logger.log("articleElement", articleElement)
                if (articleElement) {
                    articleElement.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100); // Adjust the delay as needed
        });

    } else {
        console.error('No feed element found for color:', color);
    }
}


async function displayArticles(feedData) {
    const { id: feedId } = feedData;

    // Clear previous articles
    // @ts-ignore
    articlesElement.innerHTML = '';

    // Check if articles are cached
    if (articlesCache[feedId]) {
        displayArticlesFromCache(feedId); // Display cached articles
    } else {
        // If not cached, load articles using EventSource and update UI in real-time
        await loadArticles(feedData);
    }
}





// This function is responsible for creating and displaying a single article in the UI
function createAndDisplayArticle(articleData) {
    const articleContainer = document.createElement('div');
    articleContainer.classList.add('article-container');

    if (articleData && articleData.article) {
        articleContainer.id = `article-${articleData.id}`;

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
    // @ts-ignore
    articlesElement.appendChild(articleContainer);
}

// This function is called to update the UI with the articles from the cache
function displayArticlesFromCache(feedId) {
    const articles = articlesCache[feedId];
    if (Array.isArray(articles)) {
        articles.forEach(createAndDisplayArticle);
    } else {
        logger.error(`Expected articles to be an array, but got:`, articles);
    }
}



export {
    displayArticles,
    displayArticlesFromCache,
    createAndDisplayArticle,

    toggleFeedElement,
    toggleMainContent,
    pointArticleFromNode
};