// @ts-nocheck
import { similLogger as logger } from '../logger.js';

// eslint-disable-next-line no-unused-vars
import { HUGGINGFACE_API_URL, HUGGINGFACE_TOKEN } from './similarityConfig.js';
import { JINAAI_API_URL, JINAAI_KEY } from './similarityJinaaiConfig.js';
import axios from 'axios';


const URL = JINAAI_API_URL;
const KEY = JINAAI_KEY;
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
                URL,
                {
                    input: articlesWithIds.map(article => article.text),
                    model: 'jina-embeddings-v2-base-en'
                },
                {
                    headers: {

                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${KEY}`
                    }
                }
            );
            // console.log(`Response Data: ${JSON.stringify(response.data)}`);
            responses.push(response);
            break;
        } catch (error) {
            if (!error.response) {
                logger.warn('Error connecting to Jina AI:', error);
                break;
            }

            if (error.response.status === 402) {
                throw new Error('Jina AI API key is invalid or depleted.' + error.message);
            }

            if (error.response.status === 503 && i < retries - 1) {
                const retryWaitTime = error.response.data.estimated_time || waitTime;
                logger.log(`API is unavailable, retrying in ${retryWaitTime} seconds...`);
                await sleep(retryWaitTime);
            } else {
                responses.push(new Error('Failed to retrieve embeddings : ' + error.message));
                break;
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
    const embeddings = responses
        .filter(response => !(response instanceof Error) && response.data && response.data.data)
        .flatMap(response => response.data.data.map(item => ({ id: articlesWithIds[item.index].id, embedding: item.embedding })));

    const errors = responses
        .filter(response => response instanceof Error)
        .map((error, index) => ({ id: articlesWithIds[index].id, error }));

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