import { similLogger as logger } from '../logger.js';

function calculateSimilarity(vector1, vector2) {
    logger.log("Hello from calculateSimilarity!");
    // Check if both vectors are defined and non-zero
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    if (magnitude1 === 0 || magnitude2 === 0) {
        //logger.warn('One or both vectors are zero vectors: ', vector1, vector2);
        return 0; // Cosine similarity is 0 for zero vectors
    }

    // Normalize vectors to unit length for cosine similarity
    const norm1 = vector1.map(val => val / magnitude1);
    const norm2 = vector2.map(val => val / magnitude2);

    // Calculate dot product
    const dotProduct = norm1.reduce((sum, val, i) => sum + val * norm2[i], 0);
    //logger.log(`Calculated similarity: ${dotProduct}`);
    return dotProduct; // This is the cosine similarity
}

export { calculateSimilarity }