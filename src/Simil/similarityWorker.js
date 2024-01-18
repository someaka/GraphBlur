// src/Simil/similarityWorker.js
import { parentPort } from 'worker_threads';
import { similWorkerLogger as logger } from '../logger.js';
import { calculateSimilarity } from './similarityCalculate.js';
import { WORKER_PATH } from './similarityConfig.js';
import { Worker } from 'worker_threads';


const similarityWorker = new Worker(WORKER_PATH);

// And update the event listeners accordingly
similarityWorker.on('message', (msg) => {
    logger.log('Message from similarity worker:', msg);
});

similarityWorker.on('error', (error) => {
    logger.error('Similarity worker error:', error);
});

similarityWorker.on('exit', (code) => {
    if (code !== 0) {
        logger.error(`Similarity worker stopped with exit code ${code}`);
    }
});



parentPort.on('message', ({ vector1, vector2, indexI, indexJ }) => {
    logger.log(`Worker received vectors for index ${indexI} and index ${indexJ}`);
    try {
        const similarity = calculateSimilarity(vector1, vector2);
        logger.log(`Worker calculated similarity between index ${indexI} and index ${indexJ}: ${similarity}`);
        logger.log(`Worker sending similarity result back to parent for index ${indexI} and index ${indexJ}`);
        parentPort.postMessage({ similarity, indexI, indexJ });
    } catch (error) {
        logger.error(`Error in worker: ${error.message}`);
    }
});

// Listen for a signal from the main thread to terminate the worker
parentPort.on('shutdown', () => {
    logger.log('Worker is shutting down gracefully.');
    process.exit(0); // Exit with code 0 to indicate successful completion
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception in worker: ${error.message}`);
    process.exit(1); // Exit with code 1 to indicate an error
});