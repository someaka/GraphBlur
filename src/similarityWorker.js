import { parentPort } from 'worker_threads';
import { similWorkerLogger as logger } from './logger.js';

// parentPort.postMessage({ msg: 'Hello from similarity worker!' });

function calculateSimilarity(vector1, vector2) {
    logger.log("Hello from calculateSimilarity!");
    // Check if both vectors are defined and non-zero
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    if (magnitude1 === 0 || magnitude2 === 0) {
        //logger.warn('One or both vectors are zero vectors: ', vector1, vector2);
        return 0; // Cosine similarity is 0 for zero vectors
    }

    // Normalize vectors to unit length for cosine similarity
    const norm1 = vector1.map(val => val / magnitude1);
    const norm2 = vector2.map(val => val / magnitude2);

    // Calculate dot product
    const dotProduct = norm1.reduce((sum, val, i) => sum + val * norm2[i], 0);
    //logger.log(`Calculated similarity: ${dotProduct}`);
    return dotProduct; // This is the cosine similarity
}

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