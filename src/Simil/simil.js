import { similLogger as logger } from '../logger.js';
import { getEmbeddings } from './similarityInteraction.js';
import { createWorkerPool, terminateWorkerPool } from '../utils/workerSupport.js';
import { cpus } from 'os';
import { articleCache } from '../server/articles.js';

const numCPUs = Math.max(1, cpus().length / 2 - 1);

class ArticleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ArticleError';
    }
}

function validateArticles(articles) {
    if (articles.some(article => !article || typeof article.title !== 'string' || typeof article.text !== 'string')) {
        throw new ArticleError('Article is missing title or text property');
    }
    if (articles.every(article => !`${article.title} ${article.text}`.trim())) {
        throw new ArticleError('All articles are empty. Cannot calculate similarity matrix.');
    }
}

function extractTextsFromArticles(articles) {
    return articles.map(article => `${article.title} ${article.text}`.replace(/<[^>]*>/g, ''));
}

function initializeSimilarityMatrix(size) {
    return Array.from({ length: size }, () => new Array(size).fill(0));
}

async function createSimilarityMatrix(articles) {
    
    logger.log(`Starting to get embeddings for ${articles.length} articles.`);
    validateArticles(articles);

    const texts = extractTextsFromArticles(articles);
    const embeddings = await getEmbeddings(texts);
    logger.log("Embeddings retrieved.");

    // Add embedings to articleCache for each article

    const similarityMatrix = initializeSimilarityMatrix(articles.length);
    const workerPool = createWorkerPool(numCPUs); // Worker pool is created here

    try {
        await processTasks(workerPool, articles.length, embeddings, similarityMatrix);
    } finally {
        terminateWorkerPool(workerPool); // Worker pool is terminated here
    }

    logger.log("Similarity matrix calculation completed.");
    return similarityMatrix;
}






async function processTasks(workerPool, numArticles, embeddings, similarityMatrix) {
    for (const task of generateTasks(numArticles)) {
        await new Promise((resolve, reject) => {
            getAvailableWorker(workerPool).then(worker => {
                const handleMessage = (message) => {
                    worker.removeListener('error', handleError); // Clean up the error listener
                    if (message.error) {
                        reject(new Error(message.error));
                    } else {
                        similarityMatrix[task.i][task.j] = message.similarity;
                        similarityMatrix[task.j][task.i] = message.similarity;
                        resolve();
                    }
                };
                const handleError = (error) => {
                    worker.removeListener('message', handleMessage); // Clean up the message listener
                    reject(error);
                };
                worker.once('message', handleMessage);
                worker.once('error', handleError);
                worker.postMessage({
                    vector1: embeddings[task.i],
                    vector2: embeddings[task.j],
                    indexI: task.i,
                    indexJ: task.j
                });
            });
        });

        // Log memory usage after each task
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        logger.log(`Memory usage after task: ${Math.round(used * 100) / 100} MB`);
    }
    await waitForAllWorkers(workerPool);
}





function* generateTasks(numArticles) {
    for (let i = 0; i < numArticles; i++) {
        for (let j = i + 1; j < numArticles; j++) {
            yield { i, j };
        }
    }
}

function getAvailableWorker(workerPool) {
    // This function should return a promise that resolves with an available worker
    return new Promise((resolve) => {
        const availableWorker = workerPool.workers.find(worker => !worker.isBusy);
        if (availableWorker) {
            resolve(availableWorker);
        } else {
            const onWorkerAvailable = (worker) => {
                workerPool.removeListener('workerAvailable', onWorkerAvailable);
                resolve(worker);
            };
            workerPool.on('workerAvailable', onWorkerAvailable);
        }
    });
}



function waitForAllWorkers(workerPool) {
    // This function should return a promise that resolves when all workers have completed their tasks
    const allWorkersDonePromises = workerPool.workers.map(worker => new Promise((resolve) => {
        if (worker.isBusy) {
            const onWorkerDone = () => {
                worker.removeListener('done', onWorkerDone);
                resolve();
            };
            worker.on('done', onWorkerDone);
        } else {
            resolve();
        }
    }));

    return Promise.all(allWorkersDonePromises);
}

export { createSimilarityMatrix };