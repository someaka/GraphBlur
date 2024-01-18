// eslint-disable-next-line no-unused-vars
import { similLogger as logger } from '../logger.js';

function calculateMagnitude(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
}

function calculateSimilarity(vector1, vector2) {
    // Calculate magnitudes of both vectors
    const magnitude1 = calculateMagnitude(vector1);
    const magnitude2 = calculateMagnitude(vector2);

    // If one or both vectors are zero, return 0 as similarity
    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }

    // Normalize vectors to unit length for cosine similarity calculation
    const norm1 = vector1.map(val => val / magnitude1);
    const norm2 = vector2.map(val => val / magnitude2);

    // Calculate dot product of normalized vectors
    const dotProduct = norm1.reduce((sum, val, i) => sum + val * norm2[i], 0);

    return dotProduct; // This is the cosine similarity
}

export { calculateSimilarity };
