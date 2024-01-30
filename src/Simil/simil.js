import { getEmbeddings } from './similarityInteraction.js';
import { createWorkerPool, terminateWorkerPool } from '../utils/workerSupport.js';
import { cpus } from 'os';
import { reversePairKey } from '../utils/graphHelpers.js';

// Define constants at the top of the file
const EMBEDDINGS_CALL_INTERVAL = 5000;
const RETRY_TASK_NUMBER = 3;

class CustomQueue {
    /**
     * @param {Similarity} SimilarityInstance
     */
    constructor(SimilarityInstance) {
        this.items = [];
        this.cooldown = false;
        this.cooldownTimeout = null;
        this.newSimilarityInstance = SimilarityInstance;

    }

    /**
     * @param {{ (): Promise<void>; (): Promise<any>; (): Promise<void>; (): Promise<any>; }} item
     */
    enqueue(item) {
        if (typeof item !== 'function') {
            console.error('Attempted to enqueue a non-function item:', item);
            return;
        }
        this.items.push(item);
        if (!this.cooldown && this.items.length === 1) {
            this.processItems();
        }
    }

    dequeue() {
        return this.items.shift();
    }

    async processItems() {
        if (this.cooldown) {
            return;
        }

        // Set cooldown before processing items
        this.setCooldown();

        // Process each item (function) in the queue
        while (this.items.length > 0) {
            const task = this.items.shift(); // Dequeue the next task
            await task(); // Execute the task, which should internally call updateEmbeddingsCache
        }
    }

    setCooldown() {
        this.cooldown = true;
        this.cooldownTimeout = setTimeout(() => {
            this.cooldown = false;
            if (this.items.length > 0) {
                this.processItems();
            }
        }, 5000);
    }

    clearCooldown() {
        this.cooldownTimeout = 0
        this.cooldown = false;
    }

    clear() {
        this.items = [];
    }

    isEmpty() {
        return this.items.length === 0;
    }
}



class Similarity {
    /**
     * @type {Similarity | null}
     */
    static instance = null;


    static getInstance() {
        if (!this.instance) {
            this.instance = new Similarity();
        }
        return this.instance;
    }


    constructor() {
        this.embeddingsCache = {};
        this.similarityPairs = new Map();
        this.pairsSet = new Set();
        this.numCPUs = Math.max(1, cpus().length / 2 - 1);
        this.workerPool = createWorkerPool(this.numCPUs);
        this.taskQueue = new CustomQueue(this);
        this.lastEmbeddingsCallTime = Date.now();
        this.queuedArticles = [];

    }

    /**
     * @param {any} articles
     */
    async calculateSimilarityPairs(articles) {
        // Process articles
        await this.processArticles(articles);

        // Return the updated similarity pairs
        return this.similarityPairs;
    }

    /**
     * @param {any} articles
     */
    async processArticles(articles) {
        // Validate articles
        this.validateArticles(articles);

        // Retrieve or calculate embeddings for new articles
        await this.updateEmbeddingsCache(articles);

        // Calculate similarity scores for new pairs
        await this.updateSimilarityPairs(articles);
    }

    /**
     * @param {any[]} articles
     */
    async updateEmbeddingsCache(articles) {
        const currentTime = Date.now();
        // Filter out articles already in cache
        const newArticles = articles.filter((/** @type {{ id: string | number; }} */ article) => !this.embeddingsCache[article.id]);

        if (newArticles.length > 0) {
            this.queuedArticles = this.queuedArticles.concat(newArticles);
            if (currentTime - this.lastEmbeddingsCallTime > EMBEDDINGS_CALL_INTERVAL) {
                // Remove duplicates in queuedArticles
                this.queuedArticles = Array.from(new Set(this.queuedArticles));
                const articlesWithIds = this.extractTextsFromArticles(this.queuedArticles);
                const embeddingsResults = await getEmbeddings(articlesWithIds);
                embeddingsResults.forEach(result => {
                    this.embeddingsCache[result.id] = result.embedding;
                });

                this.queuedArticles = []; // Clear the queue
                this.lastEmbeddingsCallTime = currentTime;
            }
        }
    }



    /**
     * @param {string | any[]} articles
     */
    *generateTasks(articles) {
        for (let i = 0; i < articles.length; i++) {
            for (let j = i + 1; j < articles.length; j++) {
                const id1 = articles[i].id;
                const id2 = articles[j].id;
                const pairKey = `${id1}_${id2}`;
                // Skip if similarity score already calculated
                if (this.pairsSet.has(pairKey) ||
                    this.pairsSet.has(reversePairKey(pairKey))
                ) continue;
                // Check if embeddings are cached for both ids
                if (!this.embeddingsCache[id1]) {
                    if (!this.embeddingsCache[id2]) {
                        // both missing
                        yield { id1, id2, pairKey, updateEmbeddings: 2 };
                    } else {
                        // id1 missing
                        yield { id1, id2, pairKey, updateEmbeddings: 0 };
                    }
                } else {
                    if (!this.embeddingsCache[id2]) {
                        // id2 missing
                        yield { id1, id2, pairKey, updateEmbeddings: 1 };
                    } else {
                        yield { id1, id2, pairKey };
                    }
                }

            }
        }
    }



    /**
     * @param {any[]} articles
     */
    async updateSimilarityPairs(articles) {
        try {
            // Initialize worker pool if not already initialized
            if (!this.workerPool) {
                this.workerPool = createWorkerPool(this.numCPUs);
            }

            // Generate tasks for each pair of articles
            const tasks = this.generateTasks(articles);

            // Keep track of articles that need their embeddings updated
            const articlesToUpdate = new Set();

            // Enqueue tasks for processing
            for (const task of tasks) {
                if (task.updateEmbeddings) {
                    switch (task.updateEmbeddings) {
                        case 0:
                            articlesToUpdate.add(task.id1);
                            break;
                        case 1:
                            articlesToUpdate.add(task.id2);
                            break;
                        case 2:
                            articlesToUpdate.add(task.id1);
                            articlesToUpdate.add(task.id2);
                            break;
                        default:
                            throw new Error(`Invalid updateEmbeddings value: ${task.updateEmbeddings}`);
                    }

                } else {
                    // Otherwise, enqueue the task for processing
                    this.taskQueue.enqueue(() => this.processTask(this.workerPool, task));
                }
            }

            // Enqueue a single task to update the embeddings for each unique article
            for (const articleId of articlesToUpdate) {
                const missingArticles = articles.filter((/** @type {{ id: any; }} */ article) => article.id === articleId);
                // Adds missingArticles to the article queue
                this.queuedArticles = this.queuedArticles.concat(missingArticles);
            }

            // Process tasks concurrently
            while (!this.taskQueue.isEmpty()) {
                const tasksToProcess = Array.from({ length: this.numCPUs }, () => this.taskQueue.dequeue()).filter(Boolean);
                await Promise.all(tasksToProcess.map(task => task()))
                    .catch(error => console.error(`Error processing task: ${error}`));
            }

            // Terminate worker pool
            if (this.workerPool) {
                terminateWorkerPool(this.workerPool);
                // @ts-ignore
                this.workerPool = null;
            }
        } catch (error) {
            console.error(`Error in updateSimilarityPairs: ${error}`);
        }
    }




    async processTask(workerPool, task, retries = RETRY_TASK_NUMBER) {
        const worker = await this.getAvailableWorker(workerPool);
        return new Promise((/** @type {(value?: any) => void} */resolve, reject) => {
            const handleMessage = (/** @type {{ error: string | undefined; similarity: any; }} */ message) => {
                worker.removeListener('error', handleError); // Clean up the error listener
                worker.removeListener('message', handleMessage); // Clean up the message listener
                if (message.error) {
                    reject(new Error(message.error));
                } else {
                    const reversedKey = reversePairKey(task.pairKey);
                    this.similarityPairs.set(task.pairKey, message.similarity);
                    this.similarityPairs.set(reversedKey, message.similarity);
                    this.pairsSet.add(task.pairKey);
                    this.pairsSet.add(reversedKey);
                    resolve();
                }
            };
            const handleError = (/** @type {any} */ error) => {
                worker.removeListener('error', handleError); // Clean up the error listener
                worker.removeListener('message', handleMessage); // Clean up the message listener
                reject(new Error(`Error processing task ${task.pairKey}: ${error}`));
            };
            worker.once('message', handleMessage);
            worker.once('error', handleError);
            worker.postMessage({
                vector1: this.embeddingsCache[task.id1],
                vector2: this.embeddingsCache[task.id2],
                indexI: task.id1,
                indexJ: task.id2
            });
        }).finally(() => {
            // Ensure the worker is always marked as available, even if an error occurs
            worker.busy = false;
        }).catch(error => {
            // If an error occurred, retry the task with a new worker
            if (retries > 0) {
                this.taskQueue.enqueue(() => this.processTask(this.workerPool, task, retries - 1));
            } else {
                console.error(`Failed to process task after ${retries} attempts: ${error}`);
            }
        });
    }




    async getAvailableWorker(workerPool) {
        if (workerPool) {
            return new Promise((resolve) => {
                const availableWorker = workerPool.workers.find((/** @type {{ busy: any; }} */ worker) => !worker.busy);
                if (availableWorker) {
                    availableWorker.busy = true;
                    resolve(availableWorker.worker);
                } else {
                    workerPool.once('workerAvailable', (worker) => {
                        worker.busy = true;
                        resolve(worker);
                    });
                }
            });
        }
    }



    assignZeroSimilarity(article, articles) {
        articles.forEach((otherArticle) => {
            if (otherArticle !== article) {
                this.embeddingsCache[article.id] = new Array(384).fill(0);
                this.similarityPairs.set(`${article.id}_${otherArticle.id}`, 0);
                this.similarityPairs.set(`${otherArticle.id}_${article.id}`, 0);
                this.pairsSet.add(`${article.id}_${otherArticle.id}`);
                this.pairsSet.add(`${otherArticle.id}_${article.id}`);
            }
        });
    }

    /**
     * @param {{ id: string, article: { title: string; text: string; }; }[]} articles
     */
    validateArticles(articles) {
        articles.forEach(article => {
            const hasInvalidContent = !article.article || typeof article.article.title !== 'string' || typeof article.article.text !== 'string';
            const isEmptyString = !`${article.article.title} ${article.article.text}`.trim();

            if (hasInvalidContent || isEmptyString) {
                this.assignZeroSimilarity(article, articles);
            }
        });
    }


    /**
     * @param {{ id: string; article: { title: string; text: string; }; }[]} articles
     */
    extractTextsFromArticles(articles) {
        return articles.map((/** @type {{ id: any; article: { title: any; text: any; }; }} */ article) => ({ id: article.id, text: `${article.article.title} ${article.article.text}`.replace(/<[^>]*>/g, '') }));
    }


}

/**
 * @param {{ id: string; article: { title: string; text: string; }; }[]} articles
 */
const createSimilarityPairs = (articles) =>
    Similarity.getInstance().calculateSimilarityPairs(articles);


export { createSimilarityPairs };