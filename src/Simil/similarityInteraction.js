import axios from 'axios';
import { HUGGINGFACE_API_URL, HUGGINGFACE_TOKEN } from './similarityConfig.js';
import { similLogger as logger } from '../logger.js';

const MAX_RETRIES = 5;
const DEFAULT_WAIT_TIME = 30; // in seconds



async function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function retryRequest(articlesWithIds, retries, waitTime) {
    let responses = [];
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(
                HUGGINGFACE_API_URL,
                { inputs: articlesWithIds.map(article => article.text) },
                { headers: { 'Authorization': `Bearer ${HUGGINGFACE_TOKEN}` } }
            );
            responses.push(...response.data);
            break;
        } catch (error) {
            if (error.response && error.response.status === 503 && i < retries - 1) {
                const retryWaitTime = error.response.data.estimated_time || waitTime;
                logger.log(`API is unavailable, retrying in ${retryWaitTime} seconds...`);
                await sleep(retryWaitTime);
            } else {
                responses.push(new Error('Failed to retrieve embeddings.'));
            }
        }
    }
    return responses;
}

async function getEmbeddings(articlesWithIds) {
    if (articlesWithIds.some(article => article.text == null)) {
        throw new Error('Texts array contains null or undefined values.');
    }

    const responses = await retryRequest(articlesWithIds, MAX_RETRIES, DEFAULT_WAIT_TIME);
    const embeddings = responses.filter(response => !(response instanceof Error)).map((embedding, index) => ({ id: articlesWithIds[index].id, embedding }));
    const errors = responses.filter(response => response instanceof Error).map((error, index) => ({ id: articlesWithIds[index].id, error }));

    const truncatedData = truncateDataForLogging(embeddings);
    logger.log('Embeddings retrieved (truncated):', truncatedData);

    errors.forEach(errorObj => {
        console.warn(`Warning: Failed to retrieve embeddings for article ${errorObj.id}: ${errorObj.error.message}`);
    });

    return embeddings;
}


function truncateDataForLogging(data, maxLength = 100) {
    return JSON.stringify(data).substring(0, maxLength) + '...';
}

export { getEmbeddings };