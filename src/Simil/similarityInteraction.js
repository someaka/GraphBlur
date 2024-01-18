import axios from 'axios';
import { HUGGINGFACE_API_URL, HUGGINGFACE_TOKEN } from './similarityConfig.js';
import { similLogger as logger } from '../logger.js';

const MAX_RETRIES = 5;
const DEFAULT_WAIT_TIME = 30; // in seconds

class EmbeddingsFetchError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EmbeddingsFetchError';
    }
}

async function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function retryRequest(texts, retries, waitTime) {
    let response;
    for (let i = 0; i < retries; i++) {
        try {
            response = await axios.post(
                HUGGINGFACE_API_URL,
                { inputs: texts },
                { headers: { 'Authorization': `Bearer ${HUGGINGFACE_TOKEN}` } }
            );
            return response;
        } catch (error) {
            if (error.response && error.response.status === 503 && i < retries - 1) {
                const retryWaitTime = error.response.data.estimated_time || waitTime;
                logger.log(`API is unavailable, retrying in ${retryWaitTime} seconds...`);
                await sleep(retryWaitTime);
            } else {
                throw new EmbeddingsFetchError('Failed to retrieve embeddings after retries.');
            }
        }
    }
    throw new EmbeddingsFetchError('Failed to retrieve embeddings after retries.');
}

async function getEmbeddings(texts) {
    if (texts.some(text => text == null)) {
        throw new Error('Texts array contains null or undefined values.');
    }

    const response = await retryRequest(texts, MAX_RETRIES, DEFAULT_WAIT_TIME);
    const truncatedData = truncateDataForLogging(response.data);
    logger.log('Embeddings retrieved (truncated):', truncatedData);

    return response.data;
}

function truncateDataForLogging(data, maxLength = 100) {
    return JSON.stringify(data).substring(0, maxLength) + '...';
}

export { getEmbeddings };