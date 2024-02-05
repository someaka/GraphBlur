import dotenv from 'dotenv';
dotenv.config();


const models_list = [
    "all-MiniLM-L6-v2",
    "all-mpnet-base-v2",
    "multi-qa-mpnet-base-dot-v1",
    "multi-qa-MiniLM-L6-cos-v1",
    "multi-qa-distilbert-cos-v1",
    "msmarco-distilbert-base-tas-b",
    "msmarco-bert-base-dot-v5"
]


const BASE_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/';

const model = models_list[0];

export const HUGGINGFACE_API_URL = `${BASE_URL}${model}`;
export const HUGGINGFACE_TOKEN = process.env.VITE_HUGGINGFACE_TOKEN;
export const WORKER_PATH = './src/Simil/similarityWorker.js';

if (!HUGGINGFACE_TOKEN) {
    throw new Error('The Hugging Face API token is not defined in the environment variables.');
}

