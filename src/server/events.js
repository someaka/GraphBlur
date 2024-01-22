import { serverLogger as logger } from '../logger.js';
import { createSimilarityPairs } from '../Simil/simil2.js';
import { EventEmitter } from 'events';

// Create an instance of the EventEmitter class to use for article updates
const articleUpdateEmitter = new EventEmitter();


function sendSimilarityPairsUpdate(clients, similarityPairs) {
  clients.forEach(clientRes => {
    clientRes.write(`event: similarityPairsUpdate\ndata: ${JSON.stringify(similarityPairs)}\n\n`);
  });
}

// Define a separate function for similarity Pairs calculation
async function calculateAndSendSimilarityPairs(clients, articlesWithContent) {
  try {
    // cached articles are missing
    
    
    const filteredArticles = articlesWithContent
      .filter(article => article && article.article && article.article.title && article.article.text);
    const similarityPairs = await createSimilarityPairs(filteredArticles);
    sendSimilarityPairsUpdate(clients, similarityPairs); // Make sure to pass the clients array
    // console.log("similarity Pairs sent", similarityPairs);
  } catch (error) {
    logger.error('Error calculating similarity Pairs:', error);
  }
}

export {
  articleUpdateEmitter,
  calculateAndSendSimilarityPairs
};