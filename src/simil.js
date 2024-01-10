import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { similLogger as logger } from './logger.js';
import { Worker } from 'worker_threads';
import { cpus } from 'os';

const numCPUs = cpus().length;
const workerPath = './src/similarityWorker.js'



const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';
const HUGGINGFACE_TOKEN = process.env.VITE_HUGGINGFACE_TOKEN;

if (!HUGGINGFACE_TOKEN) {
    throw new Error('The Hugging Face API token is not defined in the environment variables.');
}


// With this line
const similarityWorker = new Worker(workerPath);

// And update the event listeners accordingly
similarityWorker.on('message', (msg) => {
    console.log('Message from similarity worker:', msg);
});

similarityWorker.on('error', (error) => {
    console.error('Similarity worker error:', error);
});

similarityWorker.on('exit', (code) => {
    if (code !== 0) {
        console.error(`Similarity worker stopped with exit code ${code}`);
    }
});

function createWorkerPool(numWorkers) {
    const workers = [];
    for (let i = 0; i < numWorkers; i++) {
        try {
            const worker = new Worker(workerPath);
            workers.push(worker);
            //logger.log(`Worker ${i} is ready to receive messages.`);
        } catch (error) {
            logger.error(`Error creating worker ${i}:`, error);
        }
    }
    return workers;
}

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
                console.log(`API is unavailable, retrying in ${waitTime} seconds...`);
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


async function createSimilarityMatrix(articles) {
    logger.log(`Starting to get embeddings for ${articles.length} articles.`);

    // Adjust the mapping to the new article structure
    const texts = articles.map(article => {
        if (!article || typeof article.title !== 'string' || typeof article.text !== 'string') {
            throw new Error('Article is missing title or text property');
        }
        return `${article.title} ${article.text}`.replace(/<[^>]*>/g, '');
    });

    if (texts.every(text => !text.trim())) {
        throw new Error('All articles are empty. Cannot calculate similarity matrix.');
    }

    const embeddings = await getEmbeddings(texts);
    logger.log("Embeddings retrieved.");

    const similarityMatrix = initializeSimilarityMatrix(articles.length);
    //logger.log("Similarity matrix initialized:", similarityMatrix);
    const workerPool = createWorkerPool(numCPUs);
    setupWorkerPoolEventListeners(workerPool);
    logger.log("Worker pool created.");
    try {
        await processTasks(workerPool, articles.length, embeddings, similarityMatrix);
    } finally {
        terminateWorkerPool(workerPool);
    }

    logger.log("Similarity matrix calculation completed.");
    return similarityMatrix;
}

function initializeSimilarityMatrix(size) {
    return Array.from({ length: size }, (_, index) =>
        new Array(size).fill(0).fill(1, index, index + 1)
    );
}

function setupWorkerPoolEventListeners(workerPool) {
    workerPool.forEach(worker => {
        //worker.on('message', message => logger.log('Message from worker:', message));
        worker.on('error', error => logger.error('Worker error:', error));
        worker.on('exit', code => code !== 0 && logger.error(`Worker stopped with exit code ${code}`));
    });
}

function terminateWorkerPool(workerPool) {
    workerPool.forEach(worker => {
        worker.postMessage({ type: 'shutdown' }); // Send a shutdown message to the worker
    });
}

async function processTasks(workerPool, numArticles, embeddings, similarityMatrix) {
    const taskGenerator = generateTasks(numArticles);

    const promises = workerPool.map(worker =>
        new Promise((resolve, reject) => {
            const handleNextTask = async () => {
                const { done, value } = taskGenerator.next();
                if (!done) {
                    const { i, j } = value;
                    worker.postMessage({
                        vector1: embeddings[i],
                        vector2: embeddings[j],
                        indexI: i,
                        indexJ: j
                    });
                } else {
                    resolve();
                }
            };

            worker.on('message', (message) => {
                if ('similarity' in message) {
                    const { similarity, indexI, indexJ } = message;
                    if (similarityMatrix && indexI < similarityMatrix.length && indexJ < similarityMatrix.length) {
                        similarityMatrix[indexI][indexJ] = similarity;
                        similarityMatrix[indexJ][indexI] = similarity;
                    } else {
                        console.error(`Invalid indices or uninitialized matrix: indexI=${indexI}, indexJ=${indexJ}`);
                    }
                    handleNextTask();
                } else {
                    // Handle other types of messages, such as the greeting message
                    console.log('Message from worker:', message);
                }
            });

            worker.on('error', reject);
            worker.on('exit', resolve);

            handleNextTask();
        })
    );

    await Promise.all(promises);
}

function* generateTasks(numArticles) {
    for (let i = 0; i < numArticles; i++) {
        for (let j = i + 1; j < numArticles; j++) {
            yield { i, j };
        }
    }
}

export {
    getEmbeddings,
    createSimilarityMatrix // Export the new function
};