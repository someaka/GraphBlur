import { cpus } from 'os';
import { getEmbeddings } from './similarityInteraction.js';
import { createWorkerPool } from '../utils/workerSupport.js';



// Define constants at the top of the file
const EMBEDDINGS_CALL_INTERVAL = 5000;


class Similarity {
    /**
     * @type {Similarity | null}
     */
    static instance = null;

    /**
     * @type {Record<string, number>}
     */
    similarityPairs;

    /**
     * @type {Set<string>}
     */
    pairsSet;

    /**
     * @type {number}
     */
    numCPUs;


    workerPool;

    /**
     * @type {Array<{ id: string, article: { title: string; text: string; }; }>}
     */
    queuedArticles;

    /**
     * @type {number}
     */
    lastEmbeddingsCallTime;

    /**
     * @type {boolean}
     */
    isProcessing;

    /**
     * @type {Record<string, number[]>}
     */
    embeddingsCache;


    static getInstance() {
        if (!this.instance) {
            this.instance = new Similarity();
        }
        return this.instance;
    }

    constructor() {
        this.initialize();
    }

    initialize() {
        this.embeddingsCache = {};
        this.similarityPairs = {};
        this.pairsSet = new Set();
        this.numCPUs = Math.max(1, cpus().length / 2 - 1);
        this.workerPool = createWorkerPool(this.numCPUs);
        this.queuedArticles = [];
        this.lastEmbeddingsCallTime = 0;
        this.isProcessing = false;

    }








    async calculateSimilarityPairs(articles) {

        await this.fetchEmbedings(articles);

        // Calculate similarity scores for new pairs
        await this.updateSimilarityPairs(articles);

        // Return the updated similarity pairs
        return this.similarityPairs;

    }




    async fetchEmbedings(articles) {
        // Check which articles we don't have in embeddings cache
        const articlesToFetch = articles.filter((article) =>
            this.embeddingsCache[article.id] === undefined);


        if (articlesToFetch.length > 0) {
            this.queuedArticles = this.queuedArticles.concat(articlesToFetch);
            // Schedule a call to get embeddings
            await this.waitForEmbeddings();
        }

    }



    async waitForEmbeddings() {

        const currentTime = Date.now();
        const elapsedTime = currentTime - this.lastEmbeddingsCallTime;

        if (elapsedTime < EMBEDDINGS_CALL_INTERVAL) {
            setTimeout(() => { }, EMBEDDINGS_CALL_INTERVAL - elapsedTime);
        }

        if (this.isProcessing) {
            // wait for isProcessing to be false again
            await new Promise(resolve => {
                const checkIsProcessing = () => {
                    if (!this.isProcessing) {
                        resolve(undefined);
                    } else {
                        setTimeout(checkIsProcessing, 100);
                    }
                };
                checkIsProcessing();
            });
        } else {
            this.isProcessing = true;

            // Remove duplicates in queuedArticles
            this.queuedArticles = Array.from(new Set(this.queuedArticles));
            const articlesWithIds = this.extractTextsFromArticles(this.queuedArticles);
            this.queuedArticles = [];

            const embeddingsResults = await getEmbeddings(articlesWithIds);
            embeddingsResults.forEach(result => {
                this.embeddingsCache[result.id] = result.embedding;
            });

            this.lastEmbeddingsCallTime = currentTime;

            this.isProcessing = false;
        }

    }

    extractTextsFromArticles(articles) {
        return articles.map((/** @type {{ id: string; article: { title: string; text: string; }; }} */ article) =>
            ({ id: article.id, text: `${article.article.title} ${article.article.text}`.replace(/<[^>]*>/g, '') }));
    }





    async updateSimilarityPairs(articles) {
        // Generate tasks for each pair of articles
        const tasks = this.generateTasks(articles);
        let validTasks = [];

        // Keep track of articles that need their embeddings updated
        const articlesToUpdate = new Set();

        // Enqueue tasks for processing
        for (const task of tasks) {
            const { id1, id2, em1, em2 } = task;
            if (!em1) articlesToUpdate.add(id1);
            if (!em2) articlesToUpdate.add(id2);
            if (em1 && em2) validTasks.push(task);
        }

        const missingArticles = articles.filter(article => articlesToUpdate.has(article.id));


        // Process tasks
        if (validTasks.length > 0) {
            await this.processCalculations(validTasks);
        }
        if (missingArticles.length > 0) {
            await this.calculateSimilarityPairs(missingArticles);
        }

    }

    * generateTasks(articles) {
        for (let i = 0; i < articles.length; i++) {
            for (let j = i + 1; j < articles.length; j++) {
                const id1 = articles[i].id;
                const id2 = articles[j].id;
                const em1 = this.embeddingsCache[id1];
                const em2 = this.embeddingsCache[id2];

                // Skip if similarity score already calculated
                if (this.pairsSet.has(`${id1}_${id2}`) ||
                    this.pairsSet.has(`${id2}_${id1}`)
                ) continue;

                yield { id1, id2, em1, em2 };

            }
        }
    }

    async processCalculations(tasks) {

        try {
            while (tasks.length > 0) {

                // Gets all available workers in the pool
                let workers = this.workerPool.getAvailableWorkers();

                if (workers.length > 0) {
                    // Marks the workers as busy
                    workers.forEach(worker => worker.busy = true);

                } else {
                    const availableWorker = await this.waitForWorkers();
                    workers = [availableWorker];
                }

                // Pop as much tasks as we have workers available
                const numTasks = Math.min(workers.length, tasks.length);
                const poppedTasks = tasks.splice(0, numTasks);


                // process tasks for each worker
                for (const worker of workers) {
                    const workerTask = poppedTasks.shift();
                    // Process the task using the worker
                    const res = await this.processTask(worker.worker, workerTask);
                    if (res) {
                        const { pairKey, similarity } = res;
                        this.similarityPairs[pairKey] = similarity;
                    }
                }

            }
        } catch (error) {
            console.error("Error during processCalculations: ", error);
        }

    }

    async waitForWorkers() {
        return new Promise((resolve) => {
            // Wait for a worker to become available
            const grabWorker = (worker) => {
                if (!worker.busy) {
                    this.workerPool.removeListener('workerAvailable', grabWorker);
                    worker.busy = true;
                    resolve(worker);
                }
            }
            this.workerPool.on('workerAvailable', grabWorker);
        })
    }


    async processTask(worker, task) {

        return new Promise((/** @type {(value?: any) => void} */resolve, reject) => {

            const pairKey = `${task.id1}_${task.id2}`;
            const reveKey = `${task.id2}_${task.id1}`;
            const cleanUp = () => {
                worker.removeListener('message', handleMessage);
                worker.removeListener('error', handleError);
            }

            const handleMessage = (message) => {
                cleanUp();
                if (message.error) {
                    reject(new Error(message.error));
                } else {
                    // this.similarityPairs.set(pairKey, message.similarity);
                    this.pairsSet.add(pairKey);
                    this.pairsSet.add(reveKey);
                    resolve({ pairKey: pairKey, similarity: message.similarity });
                }
            };

            const handleError = (error) => {
                cleanUp();
                reject(new Error(`Error processing task ${pairKey}: ${error}`));
            };

            worker.on('message', handleMessage);
            worker.on('error', handleError);
            worker.postMessage({
                vector1: task.em1,
                vector2: task.em2,
                indexI: task.id1,
                indexJ: task.id2

            });
        }).catch(error => {
            console.error(`Failed to process task: ${error}`);
        });

    }

    resetSimilarity() {
        this.initialize();
    }

}



const createSimilarityPairs = (articles) =>
    Similarity.getInstance().calculateSimilarityPairs(articles);

const resetSimilarity = () => Similarity.getInstance().resetSimilarity();

export { createSimilarityPairs, resetSimilarity };