import { graphLogger as logger } from '../logger.js';

logger.log('This is a log message from graph.js');


import {
    visualizeGraph,
    clearGraph
} from "./visualizeGraph.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '../ForceAtlas2/forceAtlas.js';

let articlesCache, similarityMatrix;
let negativeEdges = false; // Assuming this is the default value

// Setter function for negativeEdges
function setNegativeEdges(value) {
    negativeEdges = value;
    logger.log('Negative edges set to:', negativeEdges);
    updateGraphForSelectedFeeds();
}



function initializeGraphElements(nodes, links, width = DEFAULT_WIDTH, height = DEFAULT_WIDTH) {
    // Check if width and height are numbers
    if (typeof width !== 'number' || isNaN(width)) {
        logger.error('Width is not a number:', width);
        width = DEFAULT_WIDTH; // Set a default width if invalid
    }
    if (typeof height !== 'number' || isNaN(height)) {
        logger.error('Height is not a number:', height);
        height = DEFAULT_WIDTH; // Set a default height if invalid
    }

    // Default initialization values for nodes
    const defaultX = width / 2;
    const defaultY = height / 2;
    const defaultVx = 0;
    const defaultVy = 0;

    // Initialize node properties with slight randomization to avoid zero distance
    nodes.forEach(node => {
        node.x = typeof node.x === 'number' && !isNaN(node.x) ? node.x : defaultX + (Math.random() - 0.5) * 10;
        node.y = typeof node.y === 'number' && !isNaN(node.y) ? node.y : defaultY + (Math.random() - 0.5) * 10;
        node.vx = typeof node.vx === 'number' && !isNaN(node.vx) ? node.vx : defaultVx;
        node.vy = typeof node.vy === 'number' && !isNaN(node.vy) ? node.vy : defaultVy;
    });

    // // Log the node properties to confirm they are set correctly
    // nodes.forEach(node => {
    //     logger.log(`Node initialized: ${JSON.stringify(node)}`);
    // });

    // Default initialization value for link weights
    const defaultWeight = 1;

    // Initialize link weights
    links.forEach(link => {
        link.weight = typeof link.weight === 'number' && !isNaN(link.weight) ? link.weight : defaultWeight;
    });
}




function constructGraphData(articles, dimensions = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }) {
    // Create nodes for each article
    const nodes = articles.map(article => ({
        id: article.id,
        title: article.title,
        color: article.feedColor,
    }));

    // Initialize nodes and set default positions and velocities
    initializeGraphElements(nodes, [], dimensions.width, dimensions.height);

    // Now create links between all nodes (initially without weights)
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const link = {
                source: nodes[i], // Direct reference to the source node object
                target: nodes[j], // Direct reference to the target node object
                weight: 0.1 // Initialize with a default weight of 1
            };
            links.push(link);
        }
    }

    return { nodes, links };
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
    updateGraphForSelectedFeeds,
    setNegativeEdges,
    negativeEdges
}