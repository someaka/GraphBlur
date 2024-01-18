import axios from 'axios';
import { HUGGINGFACE_API_URL, HUGGINGFACE_TOKEN } from './similarityConfig.js';
import { similLogger as logger } from '../logger.js';


async function getEmbeddings(texts) {
    // Ensure that texts array does not contain null or undefined values
    if (texts.some(text => text == null)) {
        throw new Error('Texts array contains null or undefined values.');
    }

    let response;
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
        try {
            response = await axios.post(
                HUGGINGFACE_API_URL,
                { inputs: texts },
                { headers: { 'Authorization': `Bearer ${HUGGINGFACE_TOKEN}` } }
            );
            break; // Success, exit the loop
        } catch (error) {
            if (error.response && error.response.status === 503) {
                // Wait for the estimated time before retrying
                const waitTime = error.response.data.estimated_time || 30;
                logger.log(`API is unavailable, retrying in ${waitTime} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime * 100));
            } else {
                // Other errors should not be retried
                throw error;
            }
        }
    }

    if (!response) {
        throw new Error('Failed to retrieve embeddings after retries.');
    }

    const truncatedData = JSON.stringify(response.data).substring(0, 100) + '...';
    logger.log('Embeddings retrieved (truncated):', truncatedData);

    return response.data;
}

export { getEmbeddings };