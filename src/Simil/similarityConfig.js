import dotenv from 'dotenv';
dotenv.config();


export const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';
export const HUGGINGFACE_TOKEN = process.env.VITE_HUGGINGFACE_TOKEN;
export const WORKER_PATH = './src/Simil/similarityWorker.js';

if (!HUGGINGFACE_TOKEN) {
    throw new Error('The Hugging Face API token is not defined in the environment variables.');
}

