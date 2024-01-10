import { serverLogger as logger } from './logger.js';


import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import axios from 'axios';
import path from 'path';
import faiss from 'faiss-node';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { fileURLToPath } from 'url';
import { extract } from '@extractus/article-extractor';
import { EventEmitter } from 'events';
import { firefox } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

import { createSimilarityMatrix } from './simil.js';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const NEWSBLUR_URL = 'https://www.newsblur.com';
const PORT = process.env.PORT || 3001;

let browser;
let articleCache = {};
let feedArticleCounts = {};

wrapper(axios);

const cookieJar = new CookieJar();
const articleUpdateEmitter = new EventEmitter();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = express();
server.use(express.json());

// Initialize FAISS index
const dimension = 384; // Dimension for all-MiniLM-L6-v2 embeddings
const index = new faiss.IndexFlatL2(dimension);















async function getValidSessionCookie(cookies) {
  const sessionCookie = cookies.find(cookie => cookie.key === 'sessionid'); // Replace 'sessionid' with the actual session cookie name if different
  if (sessionCookie && new Date(sessionCookie.expires) > new Date()) {
    return sessionCookie;
  }
  return null;
}

async function performLogin(username, password) {
  const response = await axios({
    method: 'post',
    url: `${NEWSBLUR_URL}/api/login`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    jar: cookieJar,
    withCredentials: true
  });
  return response;
}

async function login(username, password) {
  logger.log(`Attempting login with username: ${username}`);

  let cookies;
  try {
    cookies = await cookieJar.getCookies(NEWSBLUR_URL);
  } catch (error) {
    logger.error('Error getting cookies:', error);
    throw new Error('Failed to retrieve cookies');
  }

  const validSessionCookie = await getValidSessionCookie(cookies);
  if (validSessionCookie) {
    logger.log('Using existing session cookie');
    return { message: 'Already logged in using valid session cookie', sessionCookie: validSessionCookie };
  }

  let response;
  try {
    response = await performLogin(username, password);
  } catch (error) {
    logger.error('Error during login request:', error);
    return { error: 'Login request failed. Please try again later.' };
  }

  // Check the response for a successful login attempt
  if (response.data.authenticated) {
    logger.log('Login successful');
    return { message: 'Login successful', ...response.data };
  } else {
    // Extract the error message from the response
    const errorMessage = response.data.errors?.__all__?.[0] || 'An error occurred during login.';
    logger.log('Login failed:', errorMessage);
    return { error: errorMessage };
  }
}


// Fetch feeds without including story content
async function fetchFeeds() {
  const response = await axios({
    method: 'get',
    url: `${NEWSBLUR_URL}/reader/feeds`,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieJar.getCookieStringSync(NEWSBLUR_URL)
    },
    params: {
      include_story_content: false // Exclude story content
    },
    jar: cookieJar,
    withCredentials: true
  });

  return response.data.feeds;
}

// Fetch stories for a specific feed without including story content
async function fetchStories(feedId, options = {}) {
  const params = new URLSearchParams({
    page: options.page || 1,
    order: options.order || 'newest',
    read_filter: 'unread',
    include_hidden: options.include_hidden || false,
    include_story_content: false // Exclude story content
  }).toString();

  let allUnreadStories = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await axios({
      method: 'get',
      url: `${NEWSBLUR_URL}/reader/feed/${feedId}?${params}&page=${page}`,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieJar.getCookieStringSync(NEWSBLUR_URL)
      },
      jar: cookieJar,
      withCredentials: true
    });

    const stories = response.data.stories || [];
    allUnreadStories = allUnreadStories.concat(stories);
    hasMore = stories.length > 0;
    page++;
  }

  return allUnreadStories;
}



// Helper function to fetch a single article// Helper function to fetch a single article with retries
async function fetchArticle(url, retries = 3) {
  if (typeof url !== 'string') {
    logger.error(`Invalid URL: ${url}`);
    return { article: null, status: 'failure', error: 'Invalid URL' };
  }
  let attempt = 0;
  while (attempt < retries) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        }
      });
      return { article: await processArticle(response.data, url), status: 'success' };
    } catch (error) {
      if (attempt === retries - 1) {
        //logger.error(`An error occurred while fetching the article from ${url}:`, error);
        retryFetchArticle(url); // Call the placeholder function when all retries fail
        return { article: null, status: 'failure', error: error.message };
      }
      attempt++;
      //logger.log(`Retrying fetch for ${url}, attempt ${attempt}`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
    }
  }
}



async function fetchArticleContentWithPlaywright(url) {
  const browser = await firefox.launch(); // Launch Firefox browser
  const page = await browser.newPage(); // Open a new page
  await page.goto(url, { waitUntil: 'networkidle', timeout: 1000 }); // Navigate to the URL
  const content = await page.content(); // Get the content of the page
  await browser.close(); // Close the browser
  return content; // Return the content
}

function retryFetchArticle(url) {
  fetchArticleContentWithPlaywright(url)
    .then(content => {
      // Assuming 'article' is the object containing the article data
      const article = { url, content };
      articleUpdateEmitter.emit('articleUpdate', article);
    })
    .catch(error => {
      logger.error('Failed to fetch article:', error);
    });
}




async function processArticle(htmlData, url) {
  try {
    // Log the URL being processed for reference
    //logger.log(`Processing article from URL: ${url}`);

    // Use the extract function from @extractus/article-extractor
    const article = await extract(htmlData, {
      // You can pass additional options if needed
    });

    if (article) {
      // Clean the content
      const cleanedContent = cleanArticleContent(article.content);

      // Log the extracted article title for reference
      //logger.log(`Extracted article title: ${article.title}`);
      return {
        title: article.title,
        text: cleanedContent, // Use the cleaned content
        url: article.url
      };
    } else {
      logger.error('Failed to extract article content. No article data returned.');
      // Return an object with empty strings for title and text
      return {
        title: '',
        text: '',
        url: url // Keep the original URL
      };
    }
  } catch (error) {
    logger.error('An error occurred while extracting the article:', error);
    // Return an object with empty strings for title and text
    return {
      title: '',
      text: '',
      url: url // Keep the original URL
    };
  }
}

import sanitizeHtml from 'sanitize-html';

function cleanArticleContent(content) {
  // Define the allowed tags and attributes
  const clean = sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      'img': ['src', 'alt']
    },
    // Do not allow any CSS styles
    allowedStyles: {}
  });

  return clean; // Return the cleaned content
}














server.post('/login', async (req, res) => {
  const { username, password = '' } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const loginResult = await login(username, password);
    if (loginResult.sessionCookie) {
      // Set the session cookie in the response
      res.cookie('sessionid', loginResult.sessionCookie.value, { expires: new Date(loginResult.sessionCookie.expires) });
    }
    res.status(200).json(loginResult);
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});


server.get('/feeds', async (req, res) => {
  try {
    const feeds = await fetchFeeds();
    const feedsWithUnreadStories = {};

    const promises = Object.keys(feeds).map(async feedId => {
      const unreadStories = await fetchStories(feedId);
      feedsWithUnreadStories[feedId] = {
        ...feeds[feedId],
        unreadStories: unreadStories.map(story => story.story_permalink)
      };
      // Cache the unread stories for each feed
      articleCache[feedId] = unreadStories;
      // logger.log("Unread stories for feed", feedId, ":", unreadStories.length);
    });

    await Promise.all(promises);
    //logger.log('Feeds with unread stories:', feedsWithUnreadStories); // Log the final feeds data

    res.status(200).send(feedsWithUnreadStories);
  } catch (error) {
    logger.error('Error processing feeds request:', error);
    res.status(500).send('Internal server error');
  }
});


server.post('/fetch-articles', async (req, res) => {
  const { feedId, selectedFeedIds } = req.body;
  if (!feedId || (!Array.isArray(selectedFeedIds) && typeof selectedFeedIds !== 'string')) {
    return res.status(400).json({ error: 'Feed ID and selected feed IDs are required' });
  }

  try {
    const articlesWithContent = await fetchArticlesWithContentForFeeds(feedId);
    res.status(200).json({ articles: articlesWithContent });

    const articlesForMatrix = (await fetchArticlesWithContentForFeeds(selectedFeedIds))
    .filter(article => article && article.article && article.article.title && article.article.text);

    // logger.log("Articles for matrix:", articlesForMatrix);

    // Calculate the similarity matrix in the background
    const similarityMatrix = await createSimilarityMatrix(articlesForMatrix.map(article => article.article));
    // Emit an event with the calculated similarity matrix
    sendSimilarityMatrixUpdate(similarityMatrix);
  } catch (error) {
    logger.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


async function fetchArticlesWithContentForFeeds(feedIds) {
  // If a single feedId is provided, convert it to an array
  if (!Array.isArray(feedIds)) {
    feedIds = [feedIds];
  }

  const allArticlesWithContent = [];

  for (const feedId of feedIds) {
    const unreadStories = articleCache[feedId] || [];
    const validUrls = unreadStories.filter(story => typeof story.story_permalink === 'string' && story.story_permalink.startsWith('http'));

    // Fetch content for each valid URL and assign a UUID
    const articlesWithContent = await Promise.all(validUrls.map(async story => {
      const articleContent = await fetchArticle(story.story_permalink);
      return {
        ...articleContent,
        id: uuidv4(), // Generate a UUID as the ID
        feedId: feedId // Include the feedId for later reference
      };
    }));

    allArticlesWithContent.push(...articlesWithContent);
  }

  return allArticlesWithContent;
}



const clients = [];

server.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add this client to the clients array
  clients.push(res);

  // When the client closes the connection, remove the corresponding response object
  req.on('close', () => {
    clients.splice(clients.indexOf(res), 1);
  });
});


// Function to emit the similarity matrix update to all clients
function sendSimilarityMatrixUpdate(similarityMatrix) {
  //logger.log("Sending similarity matrix update to clients.");
  //logger.log("Similarity Matrix:", similarityMatrix); // Add this line to log the similarity matrix
  clients.forEach(clientRes => {
    clientRes.write(`event: similarityMatrixUpdate\ndata: ${JSON.stringify(similarityMatrix)}\n\n`);
  });
  //logger.log("Sent similarity matrix update to clients.");
}

server.get('/article-updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onArticleUpdate = (article) => {
    res.write(`data: ${JSON.stringify(article)}\n\n`);
  };

  articleUpdateEmitter.on('articleUpdate', onArticleUpdate);

  req.on('close', () => {
    articleUpdateEmitter.removeListener('articleUpdate', onArticleUpdate);
  });
});


server.get('/similarity-matrix', async (req, res) => {
  //logger.log("Received request to calculate similarity matrix.");
  try {
    const articles = Object.values(articleCache);
    //logger.log(`Calculating similarity matrix for ${articles.length} articles.`);
    const similarityMatrix = await createSimilarityMatrix(articles);

    //logger.log("Similarity matrix calculated successfully.");
    res.status(200).json({ similarityMatrix });
  } catch (error) {
    logger.error('Error calculating similarity matrix:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Make sure to close the browser when your application is closing or when you no longer need it
process.on('exit', async () => {
  if (browser) await browser.close();
});


server.listen(PORT, () => {
  logger.log(`Server running on port ${PORT}`);
});