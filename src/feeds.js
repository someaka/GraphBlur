import { feedsLogger as logger } from './logger.js';

// Use logger.log instead of logger.log
logger.log('This is a log message from feeds.js');

const feedsListElement = document.querySelector('#feedslist');
const mainContentElement = document.querySelector('#maincontent');
const articlesElement = document.querySelector('#articles');
const loadingElement = document.querySelector('#loading');
const articleTemplate = document.querySelector('#articleTemplate');
const toggleButton = document.querySelector('#toggleButton');
const selectAllButton = document.querySelector('#selectAllButton');
// const mainContentSpinner = document.querySelector('#mainContentSpinner');

import { updateGraphForSelectedFeeds } from './graph.js';
import { updateFeedElementStyles } from './domUtils';


let isSameFeedClickedBool = false;
let currentFeed = null;
let articlesCache = {};

selectAllButton.onclick = () => toggleAllFeeds();

feedsListElement.onclick = async () => {
    if (!isSameFeedClickedBool) {
        mainContentElement.classList.remove('panel_overlay');
    }
    isSameFeedClickedBool = false;
};

toggleButton.onclick = async () => {
    retractMainContent();
};

const eventSourceArticles = new EventSource('/api/article-updates');

eventSourceArticles.onmessage = (event) => {
    const article = JSON.parse(event.data);
    updateArticlesUI(article);
    cacheArticle(article);
};


const eventSource = new EventSource('/api/events');

// Update graph when new similarity matrix is received
eventSource.addEventListener('similarityMatrixUpdate', (event) => {
    const similarityMatrix = JSON.parse(event.data);
    updateGraphForSelectedFeeds(articlesCache, similarityMatrix);
});





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

function cacheArticle(article) {
    const feedId = article.feedId;
    if (!articlesCache[feedId]) {
        articlesCache[feedId] = [];
    }
    // Check if the article is already in the cache to avoid duplicates
    const existingArticleIndex = articlesCache[feedId].findIndex(cachedArticle => cachedArticle.id === article.id);
    if (existingArticleIndex === -1) {
        articlesCache[feedId].push({
            id: article.id,
            title: article.title,
            content: article.content,
            feedColor: article.feedColor
        });
    }
}















async function fetchFeeds() {
    try {
        const response = await fetch('/api/feeds');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text(); // Get the response as text first

        // logger.log('Response received:', data); // Log the raw response

        try {
            const json = JSON.parse(data); // Try to parse it as JSON
            return json;
        } catch (e) {
            logger.error('Failed to parse JSON:', e);
            return null; // Return null if JSON parsing fails
        }
    } catch (error) {
        logger.error('Failed to fetch feeds:', error);
        return null; // Return null if the fetch request fails
    }
}


async function fetchHtmlResults(feedId) {
    logger.log(`Fetching articles for feedId: ${feedId}`);

    // Get all feed elements and filter the ones that have the 'clicked' class
    const selectedFeedElements = document.querySelectorAll('#feedslist div.clicked');
    // Extract the IDs of the selected feeds
    const selectedFeedIds = Array.from(selectedFeedElements).map(feedEl => feedEl.id);

    try {
        const response = await axios.post('/api/fetch-articles', {
            feedId,
            selectedFeedIds // Include the selected feed IDs in the request body
        });
        // logger.log('Response from fetch-articles:', response.data); // Log the server response
        if (response.data.warning) {
            logger.warn('Warning from fetch-articles:', response.data.warning);
        }
        if (response.data && Array.isArray(response.data.articles)) {
            return response.data.articles; // Return the articles array
        } else {
            logger.error('fetchHtmlResults did not return an array:', response.data);
            return []; // Return an empty array if the response is not as expected
        }
    } catch (error) {
        logger.error('Failed to fetch articles:', error);
        return []; // Return an empty array in case of an error
    }
}



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
        ? hueBlueStart + (colorIndex * stepSizeBlue)
        : hueGreenStart + (colorIndex * stepSizeGreen);

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


async function updateArticlesWithColor(articles, feedColor) {
    return articles.map(article => ({ ...article, feedColor }));
}

async function loadArticles(feedData) {
    const { id: feedId, nt: expectedArticlesCount, unreadStories, feedColor } = feedData;

    logger.log(`Loading articles for feed ${feedId}`);

    // Return cached articles if available
    if (articlesCache[feedId]) {
        return articlesCache[feedId];
    }

    mainContentSpinner.style.display = 'block'; // Show the spinner in the main content

    // const articleUrls = unreadStories.map(story => story.url);
    const fetchedArticles = await fetchHtmlResults(feedId);

    // Hide the spinner in the main content
    mainContentSpinner.style.display = 'none';

    if (!Array.isArray(fetchedArticles)) {
        logger.error('No articles fetched for feed:', feedId);
        return (articlesCache[feedId] = []); // Cache and return an empty array if no articles are fetched
    }

    if (fetchedArticles.length !== expectedArticlesCount) {
        logger.warn(`Expected ${expectedArticlesCount} articles for feed ${feedId}, but got ${fetchedArticles.length}`);
    }

    // Update articles with feed color and cache the result
    const articlesWithColor = await updateArticlesWithColor(fetchedArticles, feedColor);
    articlesCache[feedId] = articlesWithColor;

    return articlesWithColor;
}

function toggleMainContent(show) {
    // Slide the panel into view if show is true, otherwise slide it out of view
    mainContentElement.style.right = show ? '0px' : '-40%';
}

function toggleFeedElement(feedElement, originalColor) {
    feedElement.classList.toggle('clicked');
    feedElement.style.backgroundColor = feedElement.classList.contains('clicked') ? originalColor + '80' : originalColor;
    feedElement.style.boxShadow = feedElement.classList.contains('clicked') ? 'inset 0 0 5px rgba(0,0,0,0.3)' : '';
}

function isSameFeedClicked(feedData) {
    return feedData === currentFeed;
}

function retractMainContent() {
    toggleMainContent(false); // Move the panel back to the right
    currentFeed = null;
}

function expandMainContent(feedData) {
    currentFeed = feedData;
    toggleMainContent(true); // Move the panel to the left
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

function isCurrentDisplayedFeed(feedData) {
    return currentFeed && currentFeed.id === feedData.id;
}

function handleCurrentDisplayedFeedClick(feedElement) {
    logger.log('Currently displayed feed clicked, retracting main content');
    retractMainContent();
    toggleFeedElement(feedElement, feedElement.dataset.originalColor);
    updateGraphForSelectedFeeds(articlesCache); // Pass articlesCache as an argument
}

function isSelectedButNotDisplayed(feedElement) {
    return feedElement.classList.contains('clicked');
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

function unselectCurrentFeed() {
    if (!currentFeed) return;
    const currentFeedElement = document.querySelector(`.feed[data-id="${currentFeed.id}"]`);
    if (currentFeedElement) {
        toggleFeedElement(currentFeedElement, currentFeedElement.dataset.originalColor);
    }
}



// Utility function to sanitize and format text
function formatArticleText(text) {
    // Remove HTML tags and unwanted characters
    const sanitizedText = text.replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, ' ').trim();
    // Perform any additional formatting you need
    // ...
    return sanitizedText;
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





async function appendFeedsToDOM(feedsData) {
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
    articlesCache = {};
}


window.onload = async () => {
    loadingElement.style.display = 'block';
    mainContentElement.style.right = '-40%';

    let localFeedsData; // Declare a local variable to store feeds data

    try {
        localFeedsData = await fetchFeeds();
        if (localFeedsData) {
            await appendFeedsToDOM(localFeedsData);
            selectAllButton.style.display = 'block'; // Show the "Select All" button
            selectAllButton.onclick = () => toggleAllFeeds(localFeedsData); // Pass localFeedsData to toggleAllFeeds
        } else {
            throw new Error('No feeds data received');
        }
    } catch (error) {
        logger.error('Failed to fetch feeds:', error);
    } finally {
        loadingElement.style.display = 'none';
    }
};
