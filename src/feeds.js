const feedsListElement = document.querySelector('#feedslist');
const mainContentElement = document.querySelector('#maincontent');
const articlesElement = document.querySelector('#articles');
const loadingElement = document.querySelector('#loading');
const articleTemplate = document.querySelector('#articleTemplate');
const toggleButton = document.querySelector('#toggleButton');
const selectAllButton = document.querySelector('#selectAllButton');

import * as d3 from 'd3';
import { calculateSimilarity } from './simil.js';
import { clearGraph, updateGraphForSelectedFeeds } from './graph.js';

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





async function fetchFeeds() {
    try {
        const response = await fetch('/api/feeds');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text(); // Get the response as text first

        console.log('Response received:', data); // Log the raw response

        try {
            const json = JSON.parse(data); // Try to parse it as JSON
            return json;
        } catch (e) {
            console.error('Failed to parse JSON:', e);
            return null; // Return null if JSON parsing fails
        }
    } catch (error) {
        console.error('Failed to fetch feeds:', error);
        return null; // Return null if the fetch request fails
    }
}

async function fetchCrawleeResults(urls) {
    console.log(`Hello from fetchCrawleeResults`);

    try {
        const response = await axios.post('/api/fetch-articles', { urls });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch articles:', error);
        return [];
    }
}

async function addArticles(articles) {
    // Logic to add articles to your data structure
    // For example, you might be adding articles to an in-memory array or a database

    // After adding articles, you might want to calculate similarities or perform other operations
    // Here's a placeholder for similarity calculation
    articles.forEach(article => {
        // Calculate similarity with other articles
        // This is just a placeholder logic
        const similarityScores = articles.map(otherArticle => calculateSimilarity(article.embedding, otherArticle.embedding));
        // Do something with the similarity scores
    });

    // Return something if needed, for example, the updated list of articles with similarity scores
    return articles;
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


async function loadArticles(feedData) {
    let crawleeResults;
    console.log(`Fetched articles for feed ${feedData.id}:`, crawleeResults); // Log the fetched articles

    if (articlesCache[feedData.id]) {
        crawleeResults = articlesCache[feedData.id];
    } else {
        mainContentSpinner.style.display = 'block'; // Show the spinner in the main content

        const unreadUrls = feedData.unreadStories.slice(0, feedData.nt);
        crawleeResults = await fetchCrawleeResults(unreadUrls);
        crawleeResults.forEach(article => {
            article.feedColor = feedData.feedColor;
        });
        articlesCache[feedData.id] = crawleeResults;

        // Update the graph immediately after fetching articles
        updateGraphForSelectedFeeds(articlesCache);

        mainContentSpinner.style.display = 'none'; // Hide the spinner in the main content
    }
    await displayResults(crawleeResults);
}

function toggleMainContent(show) {
    // Slide the panel into view if show is true, otherwise slide it out of view
    mainContentElement.style.right = show ? '0px' : '-30%';
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
    console.log('Feed clicked:', feedData);

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
    console.log('Currently displayed feed clicked, retracting main content');
    retractMainContent();
    toggleFeedElement(feedElement, feedElement.dataset.originalColor);
    updateGraphForSelectedFeeds(articlesCache); // Pass articlesCache as an argument
}

function isSelectedButNotDisplayed(feedElement) {
    return feedElement.classList.contains('clicked');
}

function handleSelectedButNotDisplayedFeedClick(feedElement) {
    console.log('Feed is selected but not the displayed feed, unselecting');
    toggleFeedElement(feedElement, feedElement.dataset.originalColor);
    updateGraphForSelectedFeeds(articlesCache); // Pass articlesCache as an argument
}

async function handleNewFeedSelection(feedElement, feedData) {
    unselectCurrentFeed();
    console.log('Selecting new feed and displaying its articles');
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

async function displayArticles(feedData) {
    // Clear previous articles and graph
    articlesElement.innerHTML = '';
    //d3.select('#graphcontent').select('svg').remove();

    // Check if articles are cached
    if (!articlesCache[feedData.id]) {
        await loadArticles(feedData);
    }

    // Display articles in the articles element
    const articles = articlesCache[feedData.id];
    console.log(`Displaying articles for feed ${feedData.id}:`, articles); // Log the articles before displaying
    articles.forEach(article => {
        const articleElement = document.createElement('div');
        articleElement.textContent = `${article.title}: ${article.text}`;
        articlesElement.appendChild(articleElement);
        article.feedColor = feedData.feedColor; // Assign the feed color to the article
    });
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

async function displayResults(results) {
    console.log(`Displaying ${results.length} results`); // Add this line to print the number of results

    const articleFragment = document.createDocumentFragment();

    try {
        await Promise.all(results.map(async (articleData) => {
            const articleTemplateElement = articleTemplate.content.cloneNode(true);

            const titleElement = articleTemplateElement.querySelector('.title');
            const textElement = articleTemplateElement.querySelector('.text');
            if (titleElement) titleElement.textContent = articleData.title;
            if (textElement) textElement.textContent = articleData.text;

            articleFragment.appendChild(articleTemplateElement);
        }));

        articlesElement.appendChild(articleFragment);
    } catch (error) {
        console.error('An error occurred while displaying results:', error);
    } finally {
        loadingElement.style.display = 'none';
    }
}


function toggleAllFeeds() {
    const allFeeds = document.querySelectorAll('#feedslist div');
    const isSelecting = selectAllButton.textContent === 'Select All';

    allFeeds.forEach((feed) => {
        if (isSelecting) {
            feed.classList.add('clicked');
            feed.style.backgroundColor = feed.dataset.originalColor + '80'; // Use the stored original color
            feed.style.boxShadow = 'inset 0 0 5px rgba(0,0,0,0.3)';
        } else {
            feed.classList.remove('clicked');
            feed.style.backgroundColor = feed.dataset.originalColor; // Use the stored original color
            feed.style.boxShadow = '';
        }
    });

    selectAllButton.textContent = isSelecting ? 'Unselect All' : 'Select All';

    // Trigger graph update based on selection
    if (isSelecting) {
        updateGraphForSelectedFeeds(articlesCache); // Draw all nodes
    } else {
        clearGraph(); // Clear the graph
        retractMainContent(); // Retract the right panel
    }
}

window.onload = async () => {
    loadingElement.style.display = 'block';

    // Explicitly set the initial right property for mainContentElement
    mainContentElement.style.right = '-30%';

    try {
        const feedsData = await fetchFeeds();
        if (feedsData) {
            await appendFeedsToDOM(feedsData);
            selectAllButton.style.display = 'block'; // Show the "Select All" button
        } else {
            throw new Error('No feeds data received');
        }
    } catch (error) {
        console.error('Failed to fetch feeds:', error);
    } finally {
        loadingElement.style.display = 'none';
    }
};
