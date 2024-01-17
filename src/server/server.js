import { serverLogger as logger } from '../logger.js';

import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

import { login } from './auth.js';
import { fetchFeeds, fetchStories, saveSessionCookie, loadSessionCookie } from './serverFeedsFetching.js';
import { calculateAndSendSimilarityMatrix, articleUpdateEmitter } from './events.js';
import { articleCache, fetchArticlesWithContentForFeeds } from './articles.js';


const clients = [];
const mode = process.env.NODE_ENV === 'production'
const PORT = process.env.PORT || mode ? 3000 : 3001;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = express();
server.use(express.json());
server.use(cookieParser());

// Serve static files from Vite's build output folder (dist) only in production
if (mode) {
  server.use(express.static(path.join(__dirname, '../..', 'dist')));
}



let newsBlurSessionCookie = null;

try {
  newsBlurSessionCookie = await loadSessionCookie();
} catch (err) {
  logger.error('Error loading session cookie:', err);
}




server.post('/login', async (req, res) => {
  const { username, password = '' } = req.body; // Default password to an empty string if not provided
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const loginResult = await login(username, password);
    if (loginResult.authenticated) {
      // Save the new session cookie and return it
      newsBlurSessionCookie = loginResult.sessionCookie;
      await saveSessionCookie(newsBlurSessionCookie);
      res.status(200).json({ authenticated: true, sessionCookie: newsBlurSessionCookie });
    } else {
      res.status(401).json({ authenticated: false, error: loginResult.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
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
    // Fetch new articles for the provided feedId
    const newArticlesWithContent = await fetchArticlesWithContentForFeeds(feedId);
    // Update the cache with the new articles
    articleCache[feedId] = newArticlesWithContent;

    // Send only the new articles to the client
    res.status(200).json({ articles: newArticlesWithContent });

    // Retrieve articles from the cache for the selected feed IDs
    const cachedArticles = selectedFeedIds.flatMap(id => articleCache[id] || []);

    // Combine new articles with cached articles for similarity calculation
    const allArticlesWithContent = [...newArticlesWithContent, ...cachedArticles];

    // Call the similarity matrix calculation function with all articles
    calculateAndSendSimilarityMatrix(clients, allArticlesWithContent);
  } catch (error) {
    logger.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


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


if (mode) {
  // Serve index.html for any unknown paths
  // MUST be declared after the other endpoints
  server.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../..', 'dist', 'index.html'));
  });
}


server.listen(PORT, () => {
  logger.log(`Server running on port ${PORT}`);
});


export { newsBlurSessionCookie };