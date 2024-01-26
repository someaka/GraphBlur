// @ts-nocheck
// eslint-disable-next-line no-unused-vars
import { similLogger as logger } from '../logger.js';
import { getEmbeddings } from './similarityInteraction.js';
import { createWorkerPool, terminateWorkerPool } from '../utils/workerSupport.js';
import { cpus } from 'os';
// eslint-disable-next-line no-unused-vars
import { articleCache } from '../server/articles.js';


// class ArticleError extends Error {
//     constructor(message) {
//         super(message);
//         this.name = 'ArticleError';
//     }
// }

class Queue {
    constructor() {
        this.items = [];
    }

    enqueue(item) {
        this.items.push(item);
    }

    dequeue() {
        if (this.items.length > 0) {
            return this.items.shift();
        }
    }

    peek() {
        return this.items[this.items.length - 1];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }
}


class Similarity {
    constructor() {
        this.embeddingsCache = {};
        this.similarityPairs = {}; // Object to store similarity scores for article pairs
        this.numCPUs = Math.max(1, cpus().length / 2 - 1);
        this.workerPool = createWorkerPool(this.numCPUs);
        this.taskQueue = new Queue();
    }

    async calculateSimilarityPairs(articles) {
        // Enqueue the entire process
        this.taskQueue.enqueue(() => this.processArticles(articles));

        // Process tasks concurrently
        while (!this.taskQueue.isEmpty()) {
            const task = this.taskQueue.dequeue();
            await task();
        }

        // Return the updated similarity pairs
        return this.similarityPairs;
    }

    async processArticles(articles) {
        // Validate articles
        this.validateArticles(articles);

        // Retrieve or calculate embeddings for new articles
        await this.updateEmbeddingsCache(articles);

        // Calculate similarity scores for new pairs
        await this.updateSimilarityPairs(articles);
    }



    async updateEmbeddingsCache(articles) {
        const newArticles = articles.filter(article => !this.embeddingsCache[article.id]);
        if (newArticles.length > 0) {
            const articlesWithIds = this.extractTextsFromArticles(newArticles);
            const embeddingsResults = await getEmbeddings(articlesWithIds);
            embeddingsResults.forEach(result => {
                this.embeddingsCache[result.id] = result.embedding;
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
        // if (this.workerPool) {
        //     await this.waitForAllWorkers(this.workerPool);
        // }

        // terminateWorkerPool(this.workerPool);
        // this.workerPool = null;
    }

    *generateTasks(articles) {
        for (let i = 0; i < articles.length; i++) {
            for (let j = i + 1; j < articles.length; j++) {
                const id1 = articles[i].id;
                const id2 = articles[j].id;
                const pairKey = `${id1}_${id2}`;
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


    async getAvailableWorker(workerPool) {
        if (workerPool) {
            return new Promise((resolve) => {
                const availableWorker = workerPool.workers.find(worker => !worker.busy);
                if (availableWorker) {
                    availableWorker.busy = true;
                    resolve(availableWorker.worker);
                } else {
                    const onWorkerAvailable = (worker) => {
                        workerPool.removeListener('workerAvailable', onWorkerAvailable);
                        worker.busy = true;
                        resolve(worker);
                    };
                    workerPool.on('workerAvailable', onWorkerAvailable);
                }
            });
        }
    }



    waitForAllWorkers(workerPool) {
        // This function should return a promise that resolves when all workers have completed their tasks
        const allWorkersDonePromises = workerPool.workers.map(worker => new Promise((resolve) => {
            if (worker.busy) {
                const onWorkerDone = () => {
                    worker.removeListener('workerAvailable', onWorkerDone);
                    resolve();
                };
                worker.onmessage = onWorkerDone;
            } else {
                resolve();
            }
        }));

        return Promise.all(allWorkersDonePromises);
    }


    assignZeroSimilarity(article, articles) {
        articles.forEach(otherArticle => {
            if (otherArticle !== article) {
                this.similarityPairs[`${article.id}_${otherArticle.id}`] = 0;
                this.similarityPairs[`${otherArticle.id}_${article.id}`] = 0;
            }
        });
    }

    validateArticles(articles) {
        articles.forEach(article => {
            if (!article.article || typeof article.article.title !== 'string' || typeof article.article.text !== 'string') {
                this.assignZeroSimilarity(article, articles);
            }
            if (!`${article.article.title} ${article.article.text}`.trim()) {
                this.assignZeroSimilarity(article, articles);
            }
        });
    }



    extractTextsFromArticles(articles) {
        return articles.map(article => ({ id: article.id, text: `${article.article.title} ${article.article.text}`.replace(/<[^>]*>/g, '') }));
    }

}

const sim = new Similarity();

// Wrapper functions to use the class
function createSimilarityPairs(articles) {
    return sim.calculateSimilarityPairs(articles);
}

export { createSimilarityPairs };