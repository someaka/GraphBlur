import express from 'express';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { calculateSimilarity, getEmbeddings } from './simil.js';
import path from 'path';
import { fileURLToPath } from 'url';
import faiss from 'faiss-node';
import { extract } from '@extractus/article-extractor';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const NEWSBLUR_URL = 'https://www.newsblur.com';
const PORT = process.env.PORT || 3001;

let browser;
let articleCache = {};
let feedArticleCounts = {};

// Wrap axios with axios-cookiejar-support
wrapper(axios);

// Create a new cookie jar
const cookieJar = new CookieJar();

// Get the directory name of the current module
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
      console.error(`Invalid URL: ${url}`);
      return { article: null, status: 'failure', error: 'Invalid URL' };
  }
  let attempt = 0;
  while (attempt < retries) {
      try {
          const response = await axios.get(url, {
              headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
              }
          });
          return { article: await processArticle(response.data, url), status: 'success' };
      } catch (error) {
          if (attempt === retries - 1) {
              console.error(`An error occurred while fetching the article from ${url}:`, error);
              return { article: null, status: 'failure', error: error.message };
          }
          attempt++;
          console.log(`Retrying fetch for ${url}, attempt ${attempt}`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
      }
  }
}


async function processArticle(htmlData, url) {
  try {
      // Log the URL being processed for reference
      console.log(`Processing article from URL: ${url}`);

      // Use the extract function from @extractus/article-extractor
      const article = await extract(htmlData, {
          // You can pass additional options if needed
      });

      if (article) {
          // Clean the content
          const cleanedContent = cleanArticleContent(article.content);

          // Log the extracted article title for reference
          console.log(`Extracted article title: ${article.title}`);
          return {
              title: article.title,
              text: cleanedContent, // Use the cleaned content
              url: article.url
          };
      } else {
          console.error('Failed to extract article content. No article data returned.');
          return null;
      }
  } catch (error) {
      console.error('An error occurred while extracting the article:', error);
      return null;
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
      // console.log("Unread stories for feed", feedId, ":", unreadStories.length);
    });

    await Promise.all(promises);
    //console.log('Feeds with unread stories:', feedsWithUnreadStories); // Log the final feeds data

    res.status(200).send(feedsWithUnreadStories);
  } catch (error) {
    console.error('Error processing feeds request:', error);
    res.status(500).send('Internal server error');
  }
});


server.post('/fetch-articles', async (req, res) => {
  const { feedId } = req.body;
  try {
    // Use the cached unread stories if available
    const unreadStories = articleCache[feedId] || [];
    //console.log(`Unread stories for feedId ${feedId}:`, unreadStories);

    // Validate that unreadStories contains valid URLs
    const validUrls = unreadStories.filter(story => typeof story.story_permalink === 'string' && story.story_permalink.startsWith('http'));
    console.log(`Valid URLs for feedId ${feedId}:`, validUrls.map(story => story.story_permalink));

    const articles = await Promise.all(validUrls.map(story => fetchArticle(story.story_permalink)));
    //console.log(`Articles fetched for feedId ${feedId}:`, articles); // Log the fetched articles

    res.status(200).send({ articles });
  } catch (error) {
    // console.error('Failed to fetch articles:', error);
    res.status(500).send({ articles: [], warning: 'Internal server error' });
  }
});


// Make sure to close the browser when your application is closing or when you no longer need it
process.on('exit', async () => {
  if (browser) await browser.close();
});


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});