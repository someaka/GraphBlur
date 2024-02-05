import { serverLogger as logger } from '../logger.js';
import { createSimilarityPairs } from '../Simil/simil.js';
import { deflateSync } from 'fflate';
import { isValidArticle } from '../utils/articlesCheck.js';


// eslint-disable-next-line no-unused-vars
function mapToUint8Array(map) {
  const jsonStr = JSON.stringify([...map]);
  const encoder = new TextEncoder();
  return encoder.encode(jsonStr);
}

function recordToUint8Array(record) {
  const jsonStr = JSON.stringify(Object.entries(record));
  const encoder = new TextEncoder();
  return encoder.encode(jsonStr);
}


function sendSimilarityPairsUpdate(clients, similarityPairs) {
  clients.forEach((clientRes) => {
    const data = recordToUint8Array(similarityPairs);
    const encoded = deflateSync(data);
    let base64Data = '';
    for (let i = 0; i < encoded.length; i++) {
      base64Data += String.fromCharCode(encoded[i]);
    }
    base64Data = btoa(base64Data);
    clientRes.write(`event: similarityPairsUpdate\ndata: ${base64Data}\n\n`);
  });
}





async function calculateAndSendSimilarityPairs(clients, articlesWithContent) {
  try {

    const filteredArticles = articlesWithContent.filter(isValidArticle);

    const similarityPairs = await createSimilarityPairs(filteredArticles);
    const numPairs = Object.keys(similarityPairs).length;
    const numArticles = filteredArticles.length;
    const numExpectedPairs = numArticles * (numArticles - 1) / 2;
    const isFull = numPairs === numExpectedPairs;
    logger.log('Articles', numArticles, 'numPairs', numPairs, 'numExpectedPairs', numExpectedPairs, 'isFull', isFull);


    sendSimilarityPairsUpdate(clients, similarityPairs); // Make sure to pass the clients array
    // logger.log("similarity Pairs sent", similarityPairs);
  } catch (error) {
    logger.warn('Error calculating similarity Pairs:', error);
  }
}


export {
  calculateAndSendSimilarityPairs
};