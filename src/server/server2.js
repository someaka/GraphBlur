import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { login } from './auth.js';
import { calculateAndSendSimilarityPairs, articleUpdateEmitter } from './events.js';
import { articleCache, fetchArticlesWithContentForFeeds } from './articles.js';
import { serverLogger as logger } from '../logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Server {
  constructor() {
    this.clients = [];
    this.mode = process.env.NODE_ENV === 'production';
    this.PORT = process.env.PORT || (this.mode ? 3000 : 3001);
    this.app = express();
    this.configureMiddleware();
    this.setupRoutes();
  }

  configureMiddleware() {
    this.app.use(express.json());
    this.app.use(cookieParser());
    if (this.mode) {
      this.app.use(express.static(path.join(__dirname, '../..', 'dist')));
    }
  }

  setupRoutes() {
    this.app.post('/login', this.handleLogin.bind(this));
    this.app.get('/feeds', this.handleGetFeeds.bind(this));
    this.app.post('/fetch-articles', this.handleFetchArticles.bind(this));
    this.app.get('/article-updates', this.handleArticleUpdates.bind(this));
    this.app.get('/events', this.handleEvents.bind(this));
    if (this.mode) {
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../..', 'dist', 'index.html'));
      });
    }
  }

  handleLogin = async (req, res) => {
    const { username, password = '' } = req.body; // Default password to an empty string if not provided
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
  
    try {
      const loginResult = await login(username, password);
      if (loginResult.authenticated) {
        // The server no longer saves the session cookie, so we just return it to the client
        res.status(200).json({ authenticated: true, sessionCookie: loginResult.sessionCookie });
      } else {
        res.status(401).json({ authenticated: false, error: loginResult.error });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  handleGetFeeds = async (req, res) => {
    const sessionCookie = req.headers.cookie; // Extract the session cookie from the request headers
    try {
      const feeds = await fetchFeeds(sessionCookie);
      const feedsWithUnreadStories = {};
  
      const promises = Object.keys(feeds).map(async feedId => {
        const unreadStories = await fetchStories(sessionCookie, feedId);
        feedsWithUnreadStories[feedId] = {
          ...feeds[feedId],
          unreadStories: unreadStories.map(story => story.story_permalink)
        };
        // Cache the unread stories for each feed
        articleCache[feedId] = unreadStories;
      });
  
      await Promise.all(promises);
      res.status(200).send(feedsWithUnreadStories);
    } catch (error) {
      logger.error('Error processing feeds request:', error);
      res.status(500).send('Internal server error');
    }
  };
  
  handleFetchArticles = async (req, res) => {
    const sessionCookie = req.headers.cookie; // Extract the session cookie from the request headers
    const { feedId, selectedFeedIds } = req.body;
    if (!feedId || (!Array.isArray(selectedFeedIds) && typeof selectedFeedIds !== 'string')) {
      return res.status(400).json({ error: 'Feed ID and selected feed IDs are required' });
    }
  
    try {
      // Fetch new articles for the provided feedId
      const newArticlesWithContent = await fetchArticlesWithContentForFeeds(feedId, sessionCookie); // Pass the session cookie here
      // Update the cache with the new articles
      articleCache[feedId] = newArticlesWithContent;
  
      // Send only the new articles to the client
      res.status(200).json({ articles: newArticlesWithContent });
  
      // Retrieve articles from the cache for the selected feed IDs
      const cachedArticles = selectedFeedIds.flatMap(id => articleCache[id] || []);
  
      // Combine new articles with cached articles for similarity calculation
      const allArticlesWithContent = [...newArticlesWithContent, ...cachedArticles];
  
      // Call the similarity Pairs calculation function with all articles
      calculateAndSendSimilarityPairs(this.clients, allArticlesWithContent);
    } catch (error) {
      logger.error('Error fetching articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  handleArticleUpdates = (req, res) => {
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
  };

  handleEvents = (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  
    // Add this client to the clients array
    this.clients.push(res);
  
    // When the client closes the connection, remove the corresponding response object
    req.on('close', () => {
      this.clients.splice(this.clients.indexOf(res), 1);
    });
  };
  start() {
    this.app.listen(this.PORT, () => {
      logger.log(`Server running on port ${this.PORT}`);
    });
  }
}

// Singleton instance
const serverInstance = new Server();

// Start the server
serverInstance.start();

export { serverInstance };