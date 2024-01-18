import { Worker } from 'worker_threads';
import { WORKER_PATH } from './similarityConfig.js';
import { similLogger as logger } from '../logger.js';


function createWorkerPool(numWorkers) {
    const workers = [];
    for (let i = 0; i < numWorkers; i++) {
        try {
            const worker = new Worker(WORKER_PATH);
            workers.push(worker);
            //logger.log(`Worker ${i} is ready to receive messages.`);
        } catch (error) {
            logger.error(`Error creating worker ${i}:`, error);
        }
    }
    return workers;
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

function* generateTasks(numArticles) {
    for (let i = 0; i < numArticles; i++) {
        for (let j = i + 1; j < numArticles; j++) {
            yield { i, j };
        }
    }
}

export {
    createWorkerPool,
    setupWorkerPoolEventListeners,
    terminateWorkerPool,
    generateTasks
}