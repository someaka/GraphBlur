import { similLogger as logger } from '../logger.js';
import { calculateSimilarity } from './similarityCalculate.js';
import { parentPort } from 'worker_threads';



if (parentPort !== null) {
    parentPort.on('message', async ({ vector1, vector2, indexI, indexJ }) => {
        logger.log(`Worker received vectors for index ${indexI} and index ${indexJ}`);
        if (parentPort !== null) {
            try {
                const similarity = calculateSimilarity(vector1, vector2);
                logger.log(`Worker calculated similarity between index ${indexI} and index ${indexJ}: ${similarity}`);
                parentPort.postMessage({ type: 'taskCompleted', similarity, indexI, indexJ });
            } catch (error) {
                logger.error(`Error in worker: ${error.message}`);
                parentPort.postMessage({ type: 'taskCompleted', error: error.message, indexI, indexJ });
            }
        }
    });

    // Listen for a signal from the main thread to terminate the worker
    parentPort.on('shutdown', () => {
        logger.log('Worker is shutting down gracefully.');
        process.exit(0); // Exit with code 0 to indicate successful completion
    });

} else {
    logger.error("Parent port is null");
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception in worker: ${error.message}`);
    process.exit(1); // Exit with code 1 to indicate an error
});