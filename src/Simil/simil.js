import { getEmbeddings } from './similarityInteraction.js';
import { createWorkerPool } from '../utils/workerSupport.js';
import { cpus } from 'os';
import { reversePairKey } from '../utils/graphHelpers.js';
import { isValidArticle } from '../utils/articlesCheck.js';



// Define constants at the top of the file
const EMBEDDINGS_CALL_INTERVAL = 5000;


class Similarity {
    /**
     * @type {Similarity | null}
     */
    static instance = null;

    /**
     * @type {Map<string, number[]>}
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
        this.similarityPairs = new Map();
        this.pairsSet = new Set();
        this.numCPUs = Math.max(1, cpus().length / 2 - 1);
        this.workerPool = createWorkerPool(this.numCPUs);
        this.queuedArticles = [];
        this.lastEmbeddingsCallTime = 0;
        this.isProcessing = false;
        this.checkArticle = this.checkArticle.bind(this);

    }








    async calculateSimilarityPairs(articles) {

        await this.fetchEmbedings(articles);

        // Calculate similarity scores for new pairs
        await this.updateSimilarityPairs(articles);

        // Return the updated similarity pairs
        return this.similarityPairs;

    }






    // validateArticles(articles) {
    //     let validArticles = [];
    //     articles.forEach(article => {
    //         if (!this.embeddingsCache[article.id]) {
    //             const hasInvalidContent = !article.article || typeof article.article.title !== 'string' || typeof article.article.text !== 'string';
    //             const isEmptyString = !`${article.article.title} ${article.article.text}`.trim();

    //             if (!hasInvalidContent && !isEmptyString) {
    //                 validArticles.push(article);
    //             } else {
    //                 //this.assignZeroSimilarity(article, articles);
    //             }
    //         }
    //     });
    //     return validArticles;
    // }

    // assignZeroSimilarity(article, articles) {
    //     articles.forEach((otherArticle) => {
    //         if (otherArticle !== article) {
    //             this.embeddingsCache[article.id] = new Array(384).fill(0);
    //             this.similarityPairs.set(`${article.id}_${otherArticle.id}`, -2);
    //             //this.similarityPairs.set(`${otherArticle.id}_${article.id}`, -2);
    //             this.pairsSet.add(`${article.id}_${otherArticle.id}`);
    //             this.pairsSet.add(`${otherArticle.id}_${article.id}`);
    //         }
    //     });
    // }






    async fetchEmbedings(articles) {
        // Check which articles we already have in cache
        const articlesToFetch = this.validateArticles(articles);

        if (articlesToFetch.length > 0) {
            this.queuedArticles = this.queuedArticles.concat(articlesToFetch);
            // Schedule a call to get embeddings
            await this.waitForEmbeddings();
        }

    }

    validateArticles(articles) {
        return articles.filter(this.checkArticle);
    }

    checkArticle(article) {
        return (this.embeddingsCache[article.id] === undefined) && isValidArticle(article)
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
            const embeddingsResults = await getEmbeddings(articlesWithIds);
            embeddingsResults.forEach(result => {
                this.embeddingsCache[result.id] = result.embedding;
            });

            this.queuedArticles = [];
            this.lastEmbeddingsCallTime = currentTime;

            this.isProcessing = false;
        }

    }

    extractTextsFromArticles(articles) {
        return articles.map((/** @type {{ id: any; article: { title: any; text: any; }; }} */ article) =>
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
                validTasks.push(task);
            }
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
                // Skip if similarity score already calculated
                if (this.pairsSet.has(`${id1}_${id2}`) ||
                    this.pairsSet.has(`${id2}_${id1}`)
                ) continue;
                // Check if embeddings are cached for both ids
                if (!this.embeddingsCache[id1]) {
                    if (!this.embeddingsCache[id2]) {
                        // both missing
                        yield { id1, id2, updateEmbeddings: 2 };
                    } else {
                        // id1 missing
                        yield { id1, id2, updateEmbeddings: 0 };
                    }
                } else {
                    if (!this.embeddingsCache[id2]) {
                        // id2 missing
                        yield { id1, id2, updateEmbeddings: 1 };
                    } else {
                        yield { id1, id2 };
                    }
                }

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
                    const availableWorker = await this.waitForWorker();
                    workers = [availableWorker];
                }

                // Pop as much tasks as we have workers available
                const numTasks = Math.min(workers.length, tasks.length);
                const poppedTasks = tasks.splice(0, numTasks);


                // process tasks for each worker
                for (const worker of workers) {
                    const workerTask = poppedTasks.shift();
                    // Process the task using the worker
                    await this.processTask(worker.worker, workerTask);
                }

            }
        } catch (error) {
            console.error("Error during processCalculations: ", error);
        }

    }

    async waitForWorker() {
        return new Promise((resolve) => {
            // Wait for a worker to become available
            const grabWorker = (worker) => {
                if (!worker.busy) {
                    this.workerPool.removeListener('workerAvailable', grabWorker);
                    worker.busy = true;
                    resolve([worker]);
                }
            }
            this.workerPool.on('workerAvailable', grabWorker);
        })
    }


    async processTask(worker, task) {

        return new Promise((/** @type {(value?: any) => void} */resolve, reject) => {

            const pairKey = `${task.id1}_${task.id2}`;
            const reversedKey = reversePairKey(pairKey);

            const handleMessage = (/** @type {{ error: string | undefined; similarity: any; }} */ message) => {
                if (message.error) {
                    reject(new Error(message.error));
                } else {
                    this.similarityPairs.set(pairKey, message.similarity);
                    //this.similarityPairs.set(reversedKey, message.similarity);
                    this.pairsSet.add(pairKey);
                    this.pairsSet.add(reversedKey);
                    resolve();
                }
            };

            const handleError = (/** @type {any} */ error) => {
                reject(new Error(`Error processing task ${pairKey}: ${error}`));
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
            // worker.busy = false;
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