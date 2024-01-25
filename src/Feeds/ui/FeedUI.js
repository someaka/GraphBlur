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

function pointArticleFromNode(color, articleId) {
    // Find the feed element with the matching color
    const selectedFeedElements = document.querySelectorAll('#feedslist div.clicked');
    const feedElements = Array.from(selectedFeedElements);
    const feedElement = feedElements.find(el => el.dataset.originalColor === color);

    if (feedElement) {
        // Create a fake feedData object with just an id
        const feedData = { id: feedElement.id };
        // Display the articles for the feed in the right panel
        displayArticles(feedData).then(() => {
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
    articlesElement.innerHTML = '';

    // Check if articles are cached
    if (articlesCache[feedId]) {
        displayArticlesFromCache(feedId); // Display cached articles
    } else {
        // If not cached, load articles using EventSource and update UI in real-time
        await loadArticles(feedData);
    }
}



const articleTemplate = document.querySelector('#articleTemplate');

function updateArticlesUI(article) {
    // Check if an article container for this UUID already exists
    //broken ?
    const articleElement = articlesElement.querySelector(`.article[data-id="${article.id}"]`);
    logger.log("updated article element :", articleElement, "article id:", article.id);

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
    updateArticlesUI,
    displayArticlesFromCache,
    createAndDisplayArticle,
    
    toggleFeedElement,
    toggleMainContent,
    pointArticleFromNode
};