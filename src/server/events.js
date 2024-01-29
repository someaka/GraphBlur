import { serverLogger as logger } from '../logger.js';
import { createSimilarityPairs } from '../Simil/simil.js';
import { deflateSync } from 'fflate';
// import { TextEncoder } from 'text-encoder-lite';

function mapToUint8Array(map) {
 const jsonStr = JSON.stringify([...map]);
 const encoder = new TextEncoder();
 return encoder.encode(jsonStr);
}

function sendSimilarityPairsUpdate(clients, similarityPairs) {
  clients.forEach((clientRes) => {
      const data = mapToUint8Array(similarityPairs);
      const encoded = deflateSync(data);
      const base64Data = btoa(String.fromCharCode.apply(null, encoded));
      clientRes.write(`event: similarityPairsUpdate\ndata: ${base64Data}\n\n`);
  });
 }

 
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