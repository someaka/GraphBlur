import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { WORKER_PATH } from '../Simil/similarityConfig.js';
import { similLogger as logger } from '../logger.js';

class WorkerPool extends EventEmitter {
    constructor() {
        super();
        this.workers = [];
    }

    /**
     * @param {Worker} worker
     */
    addWorker(worker) {
        this.workers.push({ worker, busy: false });
        this.setupWorkerEventListeners(worker);
    }

    /**
     * @param {{ on: (arg0: string, arg1: { (message: any): void; (error: any): void; }) => void; once: (arg0: string, arg1: (code: any) => void) => void; }} worker
     */
    setupWorkerEventListeners(worker) {
        worker.on('message', (/** @type {{ type: string; }} */ message) => {
            if (message.type === 'taskCompleted') {
                this.markWorkerAsAvailable(worker);
            }
            // Other message handling...
        });

        worker.on('error', (/** @type {any} */ error) => {
            logger.error('Worker error:', error);
            this.markWorkerAsAvailable(worker);
        });

        worker.once('exit', (/** @type {number} */ code) => {
            if (code !== 0) {
                logger.error(`Worker stopped with exit code ${code}`);
            }
            this.markWorkerAsAvailable(worker);
        });
    }

    /**
     * @param {any} worker
     */
    markWorkerAsAvailable(worker) {
        const workerInfo = this.workers.find(info => info.worker === worker);
        if (workerInfo) {
            workerInfo.busy = false;
            this.emit('workerAvailable', worker);
        }
    }

    getAvailableWorkers() {
        return this.workers.filter(info => !info.busy);
    }

    terminateAll() {
        this.workers.forEach(info => info.worker.terminate());
    }
}

/**
 * @param {number} numWorkers
 */
function createWorkerPool(numWorkers) {
    const workerPool = new WorkerPool();
    for (let i = 0; i < numWorkers; i++) {
        try {
            const worker = new Worker(WORKER_PATH);
            workerPool.addWorker(worker);
        } catch (error) {
            logger.error(`Error creating worker ${i}:`, error);
        }
    }
    return workerPool;
}

/**
 * @param {WorkerPool} workerPool
 */
function terminateWorkerPool(workerPool) {
    try {
        workerPool.terminateAll();
    } catch (error) {
        console.error('Failed to terminate worker pool:', error);
    }
}

export {
    createWorkerPool,
    terminateWorkerPool
}