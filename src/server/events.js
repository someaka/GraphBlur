import { serverLogger as logger } from '../logger.js';
import { createSimilarityPairs } from '../Simil/simil2.js';


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
    // logger.log("similarity Pairs sent", similarityPairs);
  } catch (error) {
    logger.warn('Error calculating similarity Pairs:', error);
  }
}

export {
  calculateAndSendSimilarityPairs
};