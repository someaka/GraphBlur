import { graphLogger as logger } from '../logger.js';

logger.log('This is a log message from graph.js');

import {
    visualizeGraph,
    clearGraph
} from "./graphologySigma.js";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

let articlesCache, similarityPairs;
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



async function updateGraphForSelectedFeeds(newArticlesCache = null, newSimilarityPairs = null) {
    articlesCache = newArticlesCache || articlesCache;
    similarityPairs = newSimilarityPairs || similarityPairs;

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

    checkAndLogSimilarityPairs(graphData);

    logger.log('Graph dataB:', graphData);
    visualizeGraph(graphData);
}

function checkAndLogSimilarityPairs(graphData) {
    // If a similarity Pairs is provided, update the weights of the edges
    if (similarityPairs) {
        logger.log("negative edges: ", negativeEdges);

        // Extract weights from graphData.links before update and log them
        const weightsBeforeUpdate = graphData.links.map(link => ({ source: link.source.id, target: link.target.id, weight: link.weight }));
        logger.log('Graph data before similarity Pairs update:');
        logger.table(weightsBeforeUpdate);

        updateGraphEdgesWithSimilarityPairs(graphData, similarityPairs, !negativeEdges);
        graphData.links = negativeEdges ? graphData.links : filterEdgesByPercentile(graphData.links, 0.5);

        // Extract weights from graphData.links after update and log them
        const weightsAfterUpdate = graphData.links.map(link => ({ source: link.source.id, target: link.target.id, weight: link.weight }));
        logger.log('Graph data after similarity Pairs update:');
        logger.table(weightsAfterUpdate);

    }
}

function normalizeEdgeWeight(edgeWeight) {
    // Normalize edge weights from [-1, 1] to [0, 1]
    return (edgeWeight + 1) / 2;
}

function updateGraphEdgesWithSimilarityPairs(graphData, similarityPairs, normalize = true) {
    // Update the weights of the edges using the similarity Pairs
    graphData.links.forEach(link => {
        const pairKey = `${link.source.id}-${link.target.id}`;
        const reversePairKey = `${link.target.id}-${link.source.id}`;
        const similarityScore = similarityPairs[pairKey] || similarityPairs[reversePairKey];

        if (typeof similarityScore === 'number') {
            link.weight = normalize ? normalizeEdgeWeight(similarityScore) : similarityScore;
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