import dotenv from 'dotenv';
dotenv.config();

export const JINAAI_API_URL = "https://api.jina.ai/v1/embeddings";
export const JINAAI_KEY = process.env.VITE_JINAAI_KEY;
