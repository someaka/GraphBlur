import { similLogger as logger } from '../logger.js';
import { getEmbeddings } from './similarityInteraction.js';
import { 
    createWorkerPool, 
    setupWorkerPoolEventListeners, 
    terminateWorkerPool 
} from './workerSupport.js';
import { cpus } from 'os';


const numCPUs = cpus().length / 2 - 1;


async function createSimilarityMatrix(articles) {
    logger.log(`Starting to get embeddings for ${articles.length} articles.`);

    // Adjust the mapping to the new article structure
    const texts = articles.map(article => {
        if (!article || typeof article.title !== 'string' || typeof article.text !== 'string') {
            throw new Error('Article is missing title or text property');
        }
        return `${article.title} ${article.text}`.replace(/<[^>]*>/g, '');
    });

    if (texts.every(text => !text.trim())) {
        throw new Error('All articles are empty. Cannot calculate similarity matrix.');
    }

    const embeddings = await getEmbeddings(texts);
    logger.log("Embeddings retrieved.");

    const similarityMatrix = initializeSimilarityMatrix(articles.length);
    //logger.log("Similarity matrix initialized:", similarityMatrix);
    const workerPool = createWorkerPool(numCPUs);
    setupWorkerPoolEventListeners(workerPool);
    //logger.log("Worker pool created.");
    try {
        await processTasks(workerPool, articles.length, embeddings, similarityMatrix);
    } finally {
        terminateWorkerPool(workerPool);
    }

    logger.log("Similarity matrix calculation completed.");
    return similarityMatrix;
}

function initializeSimilarityMatrix(size) {
    return Array.from({ length: size }, (_, index) =>
        new Array(size).fill(0).fill(1, index, index + 1)
    );
}

async function processTasks(workerPool, numArticles, embeddings, similarityMatrix) {
    const taskGenerator = generateTasks(numArticles);

    const promises = workerPool.map(worker =>
        new Promise((resolve, reject) => {
            const handleNextTask = async () => {
                const { done, value } = taskGenerator.next();
                if (!done) {
                    const { i, j } = value;
                    worker.postMessage({
                        vector1: embeddings[i],
                        vector2: embeddings[j],
                        indexI: i,
                        indexJ: j
                    });
                } else {
                    resolve();
                }
            };

            worker.on('message', (message) => {
                if ('similarity' in message) {
                    const { similarity, indexI, indexJ } = message;
                    if (similarityMatrix && indexI < similarityMatrix.length && indexJ < similarityMatrix.length) {
                        similarityMatrix[indexI][indexJ] = similarity;
                        similarityMatrix[indexJ][indexI] = similarity;
                    } else {
                        logger.error(`Invalid indices or uninitialized matrix: indexI=${indexI}, indexJ=${indexJ}`);
                    }
                    handleNextTask();
                } else {
                    // Handle other types of messages, such as the greeting message
                    logger.log('Message from worker:', message);
                }
            });

            worker.on('error', reject);
            worker.on('exit', resolve);

            handleNextTask();
        })
    );

    await Promise.all(promises);
}

function* generateTasks(numArticles) {
    for (let i = 0; i < numArticles; i++) {
        for (let j = i + 1; j < numArticles; j++) {
            yield { i, j };
        }
    }
}

export { createSimilarityMatrix }