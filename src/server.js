import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import cheerio from 'cheerio';
import tough from 'tough-cookie';
//import faiss from 'faiss';
import puppeteer from 'puppeteer';
import { calculateSimilarity, getEmbeddings } from './simil.js';
import path from 'path';
import { fileURLToPath } from 'url';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
//const cookieJar = new tough.CookieJar();
const NEWSBLUR_URL = 'https://www.newsblur.com';
const PORT = process.env.PORT || 3001;

// Wrap axios with axios-cookiejar-support
wrapper(axios);

// Create a new cookie jar
const cookieJar = new CookieJar();

// const browser = await puppeteer.launch({
//   headless: 'new',
// });

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Now you can use __dirname as you would in a CommonJS module

//server.use(express.static('public'));
const server = express();
server.use(express.json());

import faiss from 'faiss-node'; // Or equivalent server-side Faiss package

// Initialize FAISS index
const dimension = 384; // Dimension for all-MiniLM-L6-v2 embeddings
const index = new faiss.IndexFlatL2(dimension);

// Endpoint to add articles and their embeddings to the Faiss index
server.post('/add-articles', async (req, res) => {
  const { articles } = req.body;
  try {
    const texts = articles.map(article => article.text);
    const embeddings = await getEmbeddings(texts);

    for (const embedding of embeddings) {
      // Add embedding to the index
      index.add(1, new Float32Array(embedding));
    }
    res.status(200).json({ message: 'Embeddings added to index successfully' });
  } catch (error) {
    console.error('Failed to add embeddings to index:', error);
    res.status(500).json({ error: 'Failed to add embeddings to index' });
  }
});

// Function to get embeddings from an external service or model


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
  console.log(`Attempting login with username: ${username}`);

  let cookies;
  try {
    cookies = await cookieJar.getCookies(NEWSBLUR_URL);
  } catch (error) {
    console.error('Error getting cookies:', error);
    throw new Error('Failed to retrieve cookies');
  }

  const validSessionCookie = await getValidSessionCookie(cookies);
  if (validSessionCookie) {
    console.log('Using existing session cookie');
    return { message: 'Already logged in using valid session cookie', sessionCookie: validSessionCookie };
  }

  let response;
  try {
    response = await performLogin(username, password);
  } catch (error) {
    console.error('Error during login request:', error);
    return { error: 'Login request failed. Please try again later.' };
  }

  // Check the response for a successful login attempt
  if (response.data.authenticated) {
    console.log('Login successful');
    return { message: 'Login successful', ...response.data };
  } else {
    // Extract the error message from the response
    const errorMessage = response.data.errors?.__all__?.[0] || 'An error occurred during login.';
    console.log('Login failed:', errorMessage);
    return { error: errorMessage };
  }
}





async function fetchFeeds() {
  const response = await axios({
    method: 'get',
    url: `${NEWSBLUR_URL}/reader/feeds`,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieJar.getCookieStringSync(NEWSBLUR_URL)
    },
    jar: cookieJar,
    withCredentials: true
  });

  return response.data.feeds;
}

async function fetchStories(feedId) {
  const response = await axios({
    method: 'get',
    url: `${NEWSBLUR_URL}/reader/feed/${feedId}`,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieJar.getCookieStringSync(NEWSBLUR_URL)
    },
    jar: cookieJar,
    withCredentials: true
  });

  return response.data.stories.filter(story => !story.read);
}

// async function fetchArticle(url) {
//   const response = await axios.get(url);
//   const $ = cheerio.load(response.data);
//   const title = $('title').text();
//   const text = $('p').text();

//   return { url, title, text };
// }

let browser;
let articleCache = {};

async function getBrowserInstance() {
  if (browser) return browser;
  browser = await puppeteer.launch({
    headless: 'new',
    //args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

async function fetchArticle(url) {
  // Check if the result is already in the cache
  if (articleCache[url]) {
    return articleCache[url];
  }

  let page;

  try {
    const browser = await getBrowserInstance();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    await page.goto(url, { waitUntil: 'networkidle0' }); // Wait until the page is fully loaded

    // Execute code in the context of the page to retrieve the title and text
    const article = await page.evaluate(() => {
      const title = document.querySelector('title') ? document.querySelector('title').innerText : '';
      const paragraphs = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div'));
      const text = paragraphs.map(element => element.innerText).join('\n');
      return { title, text };
    });

    return { url, title: article.title, text: article.text };
  } catch (error) {
    console.error(`An error occurred while fetching the article from ${url}:`, error);
    return { url, title: 'Error', text: 'Failed to fetch article' };
  } finally {
    if (page) await page.close(); // Close the page to free up resources
  }
}

// Make sure to close the browser when your application is closing or when you no longer need it
process.on('exit', async () => {
  if (browser) await browser.close();
});

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
    });

    await Promise.all(promises);

    res.status(200).send(feedsWithUnreadStories);
  } catch (error) {
    console.error('Error processing feeds request:', error);
    res.status(500).send('Internal server error');
  }
});

server.post('/fetch-articles', async (req, res) => {
  const { urls } = req.body;

  const promises = urls.map(async (url) => {
    try {
      const article = await fetchArticle(url);
      return article;
    } catch (error) {
      console.error(`Failed to crawl "${url}":`, error);
      return { url, title: 'Error', text: 'Failed to fetch article' };
    }
  });

  const results = await Promise.all(promises);

  res.status(200).send(results);
});

// server.post('/calculate-similarity', async (req, res) => {
//   const articles = req.body;
//   await addArticles(articles);
//   res.json(similarityMatrix);
// });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});