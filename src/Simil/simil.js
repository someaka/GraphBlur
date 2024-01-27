import { getEmbeddings } from './similarityInteraction.js';
import { createWorkerPool, terminateWorkerPool } from '../utils/workerSupport.js';
import { cpus } from 'os';

// Define constants at the top of the file
const EMBEDDINGS_CALL_INTERVAL = 5000;
const RETRY_TASK_NUMBER = 3;

class CustomQueue {
    constructor(newSimilarityInstance) {
        this.items = [];
        this.cooldown = false;
        this.cooldownTimeout = null;
        this.newSimilarityInstance = newSimilarityInstance;

    }

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



class NewSimilarity {
    /**
     * @type {NewSimilarity | null}
     */
    static instance = null;


    static getInstance() {
        if (!this.instance) {
            this.instance = new NewSimilarity();
        }
        return this.instance;
    }


    constructor() {
        this.embeddingsCache = {};
        this.similarityPairs = {};
        this.numCPUs = Math.max(1, cpus().length / 2 - 1);
        this.workerPool = createWorkerPool(this.numCPUs);
        this.taskQueue = new CustomQueue(this);
        this.lastEmbeddingsCallTime = Date.now();
        this.queuedArticles = [];
    }

    async calculateSimilarityPairs(articles) {
        // Enqueue the entire process
        this.taskQueue.enqueue(() => this.processArticles(articles));

        // Process tasks concurrently
        while (!this.taskQueue.isEmpty()) {
            const task = this.taskQueue.dequeue();
            //console.log(typeof task); // Add this line for debugging
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
        const currentTime = Date.now();
        // Filter out articles already in cache
        const newArticles = articles.filter(article => !this.embeddingsCache[article.id]);

        if (newArticles.length > 0) {
            // If we're within the cooldown period, enqueue articles for later processing
            if (currentTime - this.lastEmbeddingsCallTime < EMBEDDINGS_CALL_INTERVAL) {
                this.queuedArticles = this.queuedArticles.concat(newArticles);
            } else {
                // If cooldown is over, include any queued articles in the batch
                const articlesToProcess = this.queuedArticles.concat(newArticles);
                this.queuedArticles = []; // Clear the queue

                const articlesWithIds = this.extractTextsFromArticles(articlesToProcess);
                const embeddingsResults = await getEmbeddings(articlesWithIds);
                embeddingsResults.forEach(result => {
                    this.embeddingsCache[result.id] = result.embedding;
                });

                this.lastEmbeddingsCallTime = currentTime;
                // Clear the task queue if necessary, or process next items
                this.taskQueue.clear();
            }
        }
    }



    *generateTasks(articles) {
        for (let i = 0; i < articles.length; i++) {
            for (let j = i + 1; j < articles.length; j++) {
                const id1 = articles[i].id;
                const id2 = articles[j].id;
                const pairKey = `${id1}_${id2}`;
                // Skip if similarity score already calculated
                if (this.similarityPairs[pairKey] !== undefined) continue;
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
                    switch(task.updateEmbeddings) {
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
                const missingArticles = articles.filter(article => article.id === articleId);
                this.taskQueue.enqueue(() => this.processArticles(missingArticles));
            }

            // Process tasks concurrently
            while (!this.taskQueue.isEmpty()) {
                const tasksToProcess = Array.from({ length: this.numCPUs }, () => this.taskQueue.dequeue());
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
            const handleMessage = (message) => {
                worker.removeListener('error', handleError); // Clean up the error listener
                worker.removeListener('message', handleMessage); // Clean up the message listener
                if (message.error) {
                    reject(new Error(message.error));
                } else {
                    this.similarityPairs[task.pairKey] = message.similarity;
                    resolve();
                }
            };
            const handleError = (error) => {
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


const createSimilarityPairs = (articles) => NewSimilarity.getInstance().calculateSimilarityPairs(articles);


export { createSimilarityPairs };