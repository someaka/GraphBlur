import { Worker } from 'worker_threads';
import { EventEmitter } from 'events'; // Corrected import
import { WORKER_PATH } from '../Simil/similarityConfig.js';
import { similLogger as logger } from '../logger.js';



class WorkerPool extends EventEmitter {
    constructor() {
        super();
        this.workers = [];
    }

    addWorker(worker) {
        this.workers.push(worker);
        this.setupWorkerEventListeners(worker);
    }

    setupWorkerEventListeners(worker) {
        worker.isBusy = false;

        worker.on('message', message => {
            if (message.type === 'taskCompleted') {
                worker.isBusy = false;
                this.emit('workerAvailable', worker);
            }
            // Other message handling...
        });

        worker.on('error', error => {
            logger.error('Worker error:', error);
            worker.isBusy = false;
            this.emit('workerAvailable', worker);
        });

        worker.once('exit', code => {
            if (code !== 0) {
                logger.error(`Worker stopped with exit code ${code}`);
            }
            this.emit('workerDone', worker);
        });
    }

    terminateAll() {
        this.workers.forEach(worker => worker.terminate());
    }
}

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

function terminateWorkerPool(workerPool) {
    workerPool.terminateAll();
}

export {
    createWorkerPool,
    terminateWorkerPool
}