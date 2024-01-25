import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { login } from './auth.js';
import { calculateAndSendSimilarityPairs } from './events.js';
import { articleCache, fetchArticlesInBatches, eventEmitter } from './articles.js';
import { serverLogger as logger } from '../logger.js';
import { fetchFeeds, fetchStories } from './serverFeedFetcher2.js';
import { generateColors } from '../utils/colorUtils.js';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Server {
  constructor() {
    this.clients = [];
    this.feeds = {};
    this.mode = process.env.NODE_ENV === 'production';
    this.PORT = process.env.PORT || (this.mode ? 3000 : 3001);
    this.app = express();
    this.configureMiddleware();
    this.setupRoutes();
  }

  configureMiddleware() {
    this.app.use(express.json());
    this.app.use(cookieParser());

    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*'); // Replace with your client's domain
      res.header('Access-Control-Allow-Credentials', 'true');
      next();
    });

    if (this.mode) {
      this.app.use(express.static(path.join(__dirname, '../..', 'dist')));
    }
  }

  setupRoutes() {
    this.app.post('/login', this.handleLogin.bind(this));
    this.app.get('/feeds', this.handleGetFeeds.bind(this));
    this.app.post('/fetch-articles', this.handleFetchArticles.bind(this));
    this.app.get('/batch-articles', this.handleBatchArticles.bind(this));
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
        res.cookie('sessionid', loginResult.sessionCookie, {
          httpOnly: true, // The cookie is not accessible via JavaScript
          secure: true,
          sameSite: "None",
          maxAge: 3600000 // The cookie will expire after 1 hour
        });
        // The server no longer saves the session cookie, so we just return it to the client
        res.status(200).json({ authenticated: true });
      } else {
        res.status(401).json({ authenticated: false, error: loginResult.error });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };


  handleGetFeeds = async (req, res) => {
    const sessionCookie = req.cookies['sessionid'];
    try {
      this.feeds = await fetchFeeds(sessionCookie);
      this.feeds = generateColors(this.feeds);
      const feedsWithUnreadStories = {};

      const promises = Object.keys(this.feeds).map(async (feedId) => {
        const { color } = this.feeds[feedId];
        const unreadStories = await fetchStories(sessionCookie, feedId, color);
        feedsWithUnreadStories[feedId] = {
          ...this.feeds[feedId],
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
    // const sessionCookie = req.headers.cookie;
    const { feedId, selectedFeedIds } = req.body;
    if (!feedId || (!Array.isArray(selectedFeedIds) && typeof selectedFeedIds !== 'string')) {
      return res.status(400).json({ error: 'Feed ID and selected feed IDs are required' });
    }

    try {

      // Acknowledge that the batch fetching process has started
      res.status(202).json({ message: 'Batch fetching started' });

      // Fetch articles in batches
      fetchArticlesInBatches(feedId, this.feeds[feedId].color, 5).then(() => {
        // Once all batches have been fetched, call the similarity calculation
        const cachedArticles = selectedFeedIds.flatMap(id => articleCache[id] || []);
        if (cachedArticles.length > 0) {
          calculateAndSendSimilarityPairs(this.clients, cachedArticles);
        }
      }).catch(error => {
        logger.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Internal server error' });
      });
    } catch (error) {
      logger.error('Error fetching articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };



  handleBatchArticles = async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Function to send a batch of articles as an SSE
    const sendBatch = (articlesWithContent) => {
      res.write(`event: articlesBatch\ndata: ${JSON.stringify({ articles: articlesWithContent })}\n\n`);
      //logger.log("Articles sent to client:", articlesWithContent);
    };

    // Listen for 'articlesBatch' events and send them to the client
    eventEmitter.on('articlesBatch', (articlesWithContent) => {
      sendBatch(articlesWithContent);
    });
    // logger.log("EventEmitter:", eventEmitter);
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