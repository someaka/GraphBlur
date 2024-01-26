import { serverLogger as logger } from '../logger.js';
import { createSimilarityPairs } from '../Simil/simil.js';


/**
 * @param {any[]} clients
 * @param {{}} similarityPairs
 */
function sendSimilarityPairsUpdate(clients, similarityPairs) {
  clients.forEach((/** @type {{ write: (arg0: string) => void; }} */ clientRes) => {
    clientRes.write(`event: similarityPairsUpdate\ndata: ${JSON.stringify(similarityPairs)}\n\n`);
  });
}

/**
 * @param {any[]} clients
 * @param {Array<{article: {title: string, text: string}}>} articlesWithContent
 */
async function calculateAndSendSimilarityPairs(clients, articlesWithContent) {
  try {
    const filteredArticles = articlesWithContent
      .filter((article) =>
        article && article.article && article.article.title && article.article.text);

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