import { graphLogger as logger } from '../logger.js';

logger.log('This is a log message from graph.js');

import {
    visualizeGraph,
    clearGraph
} from "./graphologySigma.js";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

let articlesCache, similarityMatrix;
let negativeEdges = false; // Assuming this is the default value

// Setter function for negativeEdges
function setNegativeEdges(value) {
    negativeEdges = value;
    logger.log('Negative edges set to:', negativeEdges);
    updateGraphForSelectedFeeds();
}





function constructGraphData(articles, dimensions = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }) {
    const nodes = articlesToNodes(articles, dimensions);
    const links = articlesToLinks(nodes);
    return { nodes, links };
}

function articlesToNodes(articles, dimensions) {
    const { width, height } = validateDimensions(dimensions);
    return articles.map(article => ({
        id: article.id,
        title: article.title,
        color: article.feedColor,
        x: width / 2 + (Math.random() - 0.5) * 10,
        y: height / 2 + (Math.random() - 0.5) * 10,
        vx: 0,
        vy: 0,
        degree : 0,
        mass : 0
    }));
}

function articlesToLinks(nodes) {
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            links.push({
                source: nodes[i],
                target: nodes[j],
                weight: 0
            });
        }
    }
    return links;
}

function validateDimensions({ width, height }) {
    return {
        width: isValidNumber(width) ? width : DEFAULT_WIDTH,
        height: isValidNumber(height) ? height : DEFAULT_HEIGHT
    };
}

function isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value);
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



async function updateGraphForSelectedFeeds(newArticlesCache = null, newSimilarityMatrix = null) {
    articlesCache = newArticlesCache || articlesCache;
    similarityMatrix = newSimilarityMatrix || similarityMatrix;

    logger.log('Articles cache:', articlesCache); // Log the entire articlesCache

    const selectedFeedsElements = document.querySelectorAll('#feedslist div.clicked');
    logger.log('Selected Feeds Elements:', selectedFeedsElements); // Log the selected feeds elements

    let allArticles = [];

    selectedFeedsElements.forEach(feedElement => {
        const { id: feedId } = feedElement;
        const feedArticles = articlesCache[feedId];

        if (feedArticles) {
            const articlesWithFallbacks = feedArticles.map(article => ({
                id: article.id || '',
                title: article.article?.title || '',
                feedColor: article.feedColor || '',
                content: article.article?.text || ''
            }));
            allArticles = [...allArticles, ...articlesWithFallbacks];
        }
    });

    // Log the allArticles array after it's been populated
    logger.log('All articles:', allArticles);

    if (allArticles.length > 0) {
        updateVisualization(allArticles);
    } else {
        clearGraph();
    }
}



function updateVisualization(allArticles) {
    const graphData = constructGraphData(allArticles);
    logger.log('Graph dataa:', graphData);

    checkAndLogSimilarityMatrix(graphData);

    logger.log('Graph dataB:', graphData);
    visualizeGraph(graphData);
}

function checkAndLogSimilarityMatrix(graphData) {
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
    updateGraphForSelectedFeeds,
    setNegativeEdges,
    negativeEdges
}