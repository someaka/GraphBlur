import { graphLogger as logger } from '../logger.js';

logger.log('This is a log message from graph.js');


import {
    constructGraphData,
    visualizeGraph,
    clearGraph,
    updateForceAtlas2Settings
} from "./visualizeGraph.js";


let articlesCache, similarityMatrix;
let negativeEdges = true; // Assuming this is the default value

// Setter function for negativeEdges
function setNegativeEdges(value) {
    negativeEdges = value;
    logger.log('Negative edges set to:', negativeEdges);
    updateGraphForSelectedFeeds();
}


// Function to filter out edges below a certain percentile
function filterEdgesByPercentile(edges, percentile = 0.2) {
    // Calculate the threshold weight based on the percentile
    const weights = edges.map(edge => edge.weight).sort((a, b) => a - b);
    const index = Math.floor(percentile * weights.length);
    const threshold = weights[index];

    // Filter out edges below the threshold
    return edges.filter(edge => edge.weight >= threshold);
}


function updateSimulationSettings(newSettings) {
    // logger.log('Updating simulation settings with:', newSettings);
    updateForceAtlas2Settings(newSettings);
}

async function updateGraphForSelectedFeeds(newArticlesCache = null, newSimilarityMatrix = null) {
    articlesCache = newArticlesCache ? newArticlesCache : articlesCache;
    similarityMatrix = newSimilarityMatrix ? newSimilarityMatrix : similarityMatrix;

    logger.log('Articles cache:', articlesCache); // Log the entire articlesCache

    const selectedFeedsElements = document.querySelectorAll('#feedslist div.clicked');
    logger.log('Selected Feeds Elements:', selectedFeedsElements); // Log the selected feeds elements

    let allArticles = [];
    selectedFeedsElements.forEach(feedElement => {
        const feedId = feedElement.id;
        if (articlesCache[feedId]) {
            logger.log('Found articles for feed:', feedId, articlesCache[feedId]);
            // Map over articles, keeping failed fetches with empty fields
            const articlesWithFallbacks = articlesCache[feedId].map(article => ({
                id: article.id || '', // Use the UUID as the article ID or an empty string
                title: article.article && article.article.title ? article.article.title : '',
                feedColor: article.feedColor || '',
                content: article.article && article.article.text ? article.article.text : ''
            }));
            allArticles = allArticles.concat(articlesWithFallbacks);
        }
    });

    // Log the allArticles array after it's been populated
    logger.log('All articles:', allArticles);

    if (allArticles.length > 0) {
        const graphData = constructGraphData(allArticles);
        logger.log('Graph dataa:', graphData);



        // If a similarity matrix is provided, update the weights of the edges
        if (similarityMatrix) {
            logger.log("negative edges: ", negativeEdges);

            // Extract weights from graphData.links before update and log them
            const weightsBeforeUpdate = graphData.links.map(link => ({ source: link.source.id, target: link.target.id, weight: link.weight }));
            logger.log('Graph data before similarity matrix update:');
            logger.table(weightsBeforeUpdate);

            updateGraphEdgesWithSimilarityMatrix(graphData, similarityMatrix, !negativeEdges);
            graphData.links = negativeEdges ? graphData.links : filterEdgesByPercentile(graphData.links, 0.5);

            // Extract weights from graphData.links after update and log them
            const weightsAfterUpdate = graphData.links.map(link => ({ source: link.source.id, target: link.target.id, weight: link.weight }));
            logger.log('Graph data after similarity matrix update:');
            logger.table(weightsAfterUpdate);            
            
        }

        logger.log('Graph dataB:', graphData);
        visualizeGraph(graphData);
    } else {
        clearGraph();
    }
}

function normalizeEdgeWeight(edgeWeight) {
    // Normalize edge weights from [-1, 1] to [0, 1]
    return (edgeWeight + 1) / 2;
}

function updateGraphEdgesWithSimilarityMatrix(graphData, similarityMatrix, normalize = true) {
    // Create a map from node IDs to their indices
    const idToIndexMap = new Map(graphData.nodes.map((node, index) => [node.id, index]));

    // Update the weights of the edges using the similarity matrix
    graphData.links.forEach(link => {
        const sourceIndex = idToIndexMap.get(link.source.id);
        const targetIndex = idToIndexMap.get(link.target.id);

        if (sourceIndex !== undefined && targetIndex !== undefined &&
            similarityMatrix[sourceIndex] && similarityMatrix[targetIndex] &&
            typeof similarityMatrix[sourceIndex][targetIndex] === 'number') {

            const edgeWeight = similarityMatrix[sourceIndex][targetIndex];
            link.weight = normalize ? normalizeEdgeWeight(edgeWeight) : edgeWeight;

        } else {
            // Set a default weight of 0 for invalid links
            link.weight = 0;
        }
    });
}

export {
    updateSimulationSettings,
    updateGraphForSelectedFeeds,
    setNegativeEdges
}