import { serverLogger as logger } from '../logger.js';
import { createSimilarityMatrix } from '../simil.js';
import { fetchArticlesWithContentForFeeds } from './articles.js';
import { EventEmitter } from 'events';

// Create an instance of the EventEmitter class to use for article updates
const articleUpdateEmitter = new EventEmitter();


function sendSimilarityMatrixUpdate(clients, similarityMatrix) {
  clients.forEach(clientRes => {
    clientRes.write(`event: similarityMatrixUpdate\ndata: ${JSON.stringify(similarityMatrix)}\n\n`);
  });
}

// Define a separate function for similarity matrix calculation
async function calculateAndSendSimilarityMatrix(clients, feedIds) {
  try {
    const articlesForMatrix = (await fetchArticlesWithContentForFeeds(feedIds))
      .filter(article => article && article.article && article.article.title && article.article.text);
    const similarityMatrix = await createSimilarityMatrix(articlesForMatrix.map(article => article.article));
    sendSimilarityMatrixUpdate(clients, similarityMatrix); // Make sure to pass the clients array
  } catch (error) {
    logger.error('Error calculating similarity matrix:', error);
  }
}

export {
  articleUpdateEmitter,
  calculateAndSendSimilarityMatrix
};