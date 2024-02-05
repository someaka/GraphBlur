import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { login } from './auth.js';
import { calculateAndSendSimilarityPairs } from './events.js';
import { articleCache, fetchArticlesInBatches, eventEmitter } from './articles.js';
import { serverLogger as logger } from '../logger.js';
import { fetchFeeds, fetchStories } from './serverFeedFetcher.js';
import { generateColors } from '../utils/colorUtils.js';
import { resetSimilarity } from '../Simil/simil.js';

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

    this.currentRes = null;
    this.eventQueue = [];

    this.selectedFeedIds = [];
    //this.feedId = '';
    this.eventEmitter = eventEmitter;
    this.onBatchArticles = this.onBatchArticles.bind(this);
    this.processEventQueue = this.processEventQueue.bind(this);
    this.isProcessing = false;

    this.initializeEventHandlers();
  }

  initializeEventHandlers() {
    this.eventEmitter.on('articlesBatch', this.processEventQueue);
  }

  processEventQueue(articlesWithContent) {
    this.eventQueue.push(articlesWithContent);

    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const eventData = this.eventQueue.shift();
      this.onBatchArticles(eventData);
    }

    this.isProcessing = false;

  }

  onBatchArticles(articlesWithContent) {

    if (this.currentRes) {
      const jsonArticles = JSON.stringify({ articles: articlesWithContent });
      const batchMessage = `event: articlesBatch\ndata: ${jsonArticles}\n\n`;
      this.currentRes.write(batchMessage);

      // this.currentRes.write(`event: articlesBatch\ndata: ${JSON.stringify({ articles: articlesWithContent })}\n\n`);
    }

    if (this.selectedFeedIds) {
      const selectedArticles = this.selectedFeedIds.flatMap(id =>
        articleCache[id] || []);
      const wellFormedArticles = selectedArticles.filter(article =>
        article && article.status === 'success');
      if (wellFormedArticles.length > 0) {
        calculateAndSendSimilarityPairs(this.clients, wellFormedArticles);
      }
    }

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
    // Default password to an empty string if not provided
    const { username, password = '' } = req.body;
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

        res.status(200).json({ authenticated: true });
      } else {
        res.status(401).json({ authenticated: false, error: loginResult.error });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };


  handleGetFeeds = async (/** @type {{ cookies: { [x: string]: any; }; }} */ req, /** @type {{ status: (arg0: number) => { (): any; new (): any; send: { (arg0: string): void; new (): any; }; }; }} */ res) => {
    const sessionCookie = req.cookies['sessionid'];
    try {

      resetSimilarity();  //MUST REMOVE WILL RESET SIMILARITY EACH TIME ANY CLIENT GRABS FEEDS

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
      res.status(200).send(JSON.stringify(feedsWithUnreadStories));
    } catch (error) {
      logger.error('Error processing feeds request:', error);
      res.status(500).send('Internal server error');
    }
  };

  /**
   * @param {Object} req - The request object.
   * @param {Object} req.body - The request object.
   * @param {string} req.body.feedId - The feed ID.
   * @param {string[]} req.body.selectedFeedIds - The selected feed IDs.
   * @param {Object} res - The response object.
   */
  handleFetchArticles = (req, res) => {
    const { feedId, selectedFeedIds } = req.body;
    if (!feedId || (!Array.isArray(selectedFeedIds) && typeof selectedFeedIds !== 'string')) {
      return res.status(400).json({ error: 'Feed ID and selected feed IDs are required' });
    }

    try {
      // Update the class variables
      this.selectedFeedIds = selectedFeedIds;

      // Acknowledge that the batch fetching process has started
      res.status(202).json({ message: 'Batch fetching started' });

      const color = this.feeds[feedId].color;
      // Fetch articles in batches
      if (color) fetchArticlesInBatches(feedId, color, 5);
    } catch (error) {
      logger.error('Error fetching articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };



  handleBatchArticles = async (/** @type {any} */ req, /** @type {{ setHeader: (arg0: string, arg1: string) => void; write: (arg0: string) => void; }} */ res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    this.currentRes = res;
  };


  handleEvents = (/** @type {{ on: (arg0: string, arg1: () => void) => void; }} */ req, /** @type {{ setHeader: (arg0: string, arg1: string) => void; }} */ res) => {
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