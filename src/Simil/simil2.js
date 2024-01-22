import { similLogger as logger } from '../logger.js';
import { getEmbeddings } from './similarityInteraction.js';
import { createWorkerPool, terminateWorkerPool } from '../utils/workerSupport.js';
import { cpus } from 'os';
import { articleCache } from '../server/articles.js';


class ArticleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ArticleError';
    }
}

class Similarity {
    constructor() {
        this.embeddingsCache = {};
        this.similarityPairs = {}; // Object to store similarity scores for article pairs
        this.workerPool = null;
        this.numCPUs = Math.max(1, cpus().length / 2 - 1);
    }

    async calculateSimilarityPairs(articles) {
        // Validate articles
        this.validateArticles(articles);

        // Retrieve or calculate embeddings for new articles
        await this.updateEmbeddingsCache(articles);

        // Calculate similarity scores for new pairs
        await this.updateSimilarityPairs(articles);

        // Return the updated similarity pairs
        return this.similarityPairs;
    }


    async updateEmbeddingsCache(articles) {
        const newArticles = articles.filter(article => !this.embeddingsCache[article.id]);
        if (newArticles.length > 0) {
            const newArticleTexts = this.extractTextsFromArticles(newArticles);
            const newEmbeddings = await getEmbeddings(newArticleTexts);
            newArticles.forEach((article, index) => {
                this.embeddingsCache[article.id] = newEmbeddings[index];
            });
        }
    }


    async updateSimilarityPairs(articles) {
        // Initialize worker pool if not already initialized
        if (!this.workerPool) {
            this.workerPool = createWorkerPool(this.numCPUs);
        }

        // Generate tasks for each pair of articles
        const tasks = this.generateTasks(articles);

        // Process each task sequentially
        for (const task of tasks) {
            await this.processTask(this.workerPool, task);
        }

        // Wait for all workers to complete their tasks
        await this.waitForAllWorkers(this.workerPool);

        // Terminate worker pool if needed
        terminateWorkerPool(this.workerPool);
        this.workerPool = null;
    }

    *generateTasks(articles) {
        for (let i = 0; i < articles.length; i++) {
            for (let j = i + 1; j < articles.length; j++) {
                const id1 = articles[i].id;
                const id2 = articles[j].id;
                const pairKey = `${id1}-${id2}`;
                // Skip if similarity score already calculated
                if (this.similarityPairs[pairKey] !== undefined) continue;
                yield { id1, id2, pairKey };
            }
        }
    }

    async processTask(workerPool, { id1, id2, pairKey }) {
        const worker = await this.getAvailableWorker(workerPool);
        return new Promise((resolve, reject) => {
            const handleMessage = (message) => {
                worker.removeListener('error', handleError); // Clean up the error listener
                if (message.error) {
                    reject(new Error(message.error));
                } else {
                    this.similarityPairs[pairKey] = message.similarity;
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
                vector1: this.embeddingsCache[id1],
                vector2: this.embeddingsCache[id2],
                indexI: id1,
                indexJ: id2
            });
        });
    }


    getAvailableWorker(workerPool) {
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



    waitForAllWorkers(workerPool) {
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


    validateArticles(articles) {
        if (articles.some(article => !article.article || typeof article.article.title !== 'string' || typeof article.article.text !== 'string')) {
            throw new ArticleError('Article is missing title or text property');
        }
        if (articles.every(article => !`${article.article.title} ${article.article.text}`.trim())) {
            throw new ArticleError('All articles are empty. Cannot calculate similarity Pairs.');
        }
    }

    extractTextsFromArticles(articles) {
        return articles.map(article => `${article.article.title} ${article.article.text}`.replace(/<[^>]*>/g, ''));
    }

}

const sim = new Similarity();

// Wrapper functions to use the class
function createSimilarityPairs(articles) {
    return sim.calculateSimilarityPairs(articles);
}

export { createSimilarityPairs };