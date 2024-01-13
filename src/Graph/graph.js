import { graphLogger as logger } from '../logger.js';

logger.log('This is a log message from graph.js');


import {
    constructGraphData,
    visualizeGraph,
    clearGraph,
    updateForceParameters,
    updateForceAtlas2Settings 
} from "./visualizeGraph.js";


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
    updateForceAtlas2Settings(newSettings);
    updateForceParameters(newSettings);
}


async function updateGraphForSelectedFeeds(articlesCache, similarityMatrix = null) {
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
                title: article.article.title || '',
                feedColor: article.feedColor || '',
                content: article.article.text || ''
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
            logger.log('Graph data before similarity matrix:', graphData); // Log the graphData
            updateGraphEdgesWithSimilarityMatrix(graphData, similarityMatrix);
            // Log the graphData.links after they've been potentially updated with the similarity matrix
            logger.log('Graph data after similarity matrix:', graphData);
            //logger.log('Links:', JSON.stringify(graphData.links));

            // Filter out the weakest edges based on the percentile
            const filteredLinks = filterEdgesByPercentile(graphData.links);
            //logger.log('Filtered Links:', JSON.stringify(filteredLinks));

            // Update graphData with the filtered links
            graphData.links = filteredLinks;

            logger.log("links and filtered links are equal?", JSON.stringify(graphData.links) === JSON.stringify(filteredLinks));
        }

        logger.log('Graph dataB:', graphData);
        visualizeGraph(graphData);
    } else {
        clearGraph();
    }
}


function updateGraphEdgesWithSimilarityMatrix(graphData, similarityMatrix) {
    // Create a map from node IDs to their indices
    const idToIndexMap = new Map(graphData.nodes.map((node, index) => [node.id, index]));

    // Update the weights of the edges using the similarity matrix
    graphData.links.forEach(link => {
        const sourceIndex = idToIndexMap.get(link.source.id);
        const targetIndex = idToIndexMap.get(link.target.id);

        if (sourceIndex !== undefined && targetIndex !== undefined &&
            similarityMatrix[sourceIndex] && similarityMatrix[targetIndex] &&
            typeof similarityMatrix[sourceIndex][targetIndex] === 'number') {
            link.weight = similarityMatrix[sourceIndex][targetIndex];
        } else {
            // Set a default weight of 0 for invalid links
            link.weight = 0;
        }
    });
}

export{
    updateSimulationSettings,
    updateGraphForSelectedFeeds
}