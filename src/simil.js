// simil.js (Refactored for browser and server)
import axios from 'axios';

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';

async function getEmbeddings(texts) {
    // Replace with your actual logic to get embeddings
    // This is a placeholder example using an external API
    const response = await axios.post(
        HUGGINGFACE_API_URL,
        { inputs: texts },
        { headers: { 'Authorization': `Bearer ${process.env.HUGGINGFACE_TOKEN}` } }
    );
    return response.data;
}

function calculateSimilarity(vector1, vector2) {
    // Check if both vectors are defined
    if (!vector1 || !vector2) {
        console.warn('Undefined vector(s) in calculateSimilarity');
        return 0;
    }
    // Normalize vectors to unit length for cosine similarity
    const norm1 = vector1.map(val => val / Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0)));
    const norm2 = vector2.map(val => val / Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0)));
    // Calculate dot product
    const dotProduct = norm1.reduce((sum, val, i) => sum + val * norm2[i], 0);
    return dotProduct; // This is the cosine similarity
 }

export {
    getEmbeddings,
    calculateSimilarity
};