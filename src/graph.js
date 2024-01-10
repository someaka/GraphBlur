import { graphLogger as logger } from './logger.js';

logger.log('This is a log message from graph.js');


import * as d3 from 'd3';


export function visualizeGraph(graphData) {
    const width = 800; // Set the width of the graph
    const height = 600; // Set the height of the graph

    // Select the SVG element, creating it if it doesn't exist
    let svg = d3.select('#graphcontent').select('svg');
    if (svg.empty()) {
        logger.log("Creating new SVG");
        svg = d3.select('#graphcontent').append('svg')
            .attr('width', width)
            .attr('height', height);
    } else {
        logger.log("SVG already exists");
    }

    // Bind the new data to the nodes
    const nodes = svg.selectAll('circle')
        .data(graphData.nodes, d => d.id);

    logger.log("Nodes data:", graphData.nodes);

    // Enter new nodes
    const enteredNodes = nodes.enter().append('circle')
        .attr('r', 5)
        .attr('fill', d => d.color)
        .call(d3.drag() // Re-apply drag behavior to new and updated nodes
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded))
        .on('click', nodeClicked); // Add click event listener to nodes

    logger.log("Entered nodes:", enteredNodes.nodes());

    enteredNodes.merge(nodes) // Merge enter and update selections
        .call(d3.drag() // Re-apply drag behavior to new and updated nodes
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded))
        .on('click', nodeClicked); // Add click event listener to nodes

    // Remove old nodes
    nodes.exit().remove();

    // Define and start the simulation if it's not already running
    if (!window.simulation) {
        logger.log("Creating new simulation");
        window.simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links)
                .id(d => d.id)
                .distance(link => link.weight) // Use the weight to determine the distance between nodes
                .strength(0.1)) // Adjust the strength to control the tightness of the nodes
            .force('charge', d3.forceManyBody().strength(-50)) // Adjust the repulsive force strength
            .force('center', d3.forceCenter(width / 2, height / 2))
            .on('tick', ticked);
    } else {
        logger.log("Updating simulation");
        window.simulation.nodes(graphData.nodes);
        window.simulation.force('link').links(graphData.links);
        window.simulation.alpha(0.3).restart();
    }

    function ticked() {
        // Update node positions
        svg.selectAll('circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    }

    function nodeClicked(event, clickedNode) {
        console.log('Clicked node:', clickedNode); // Log the clickedNode object
        const connectedLinks = graphData.links.filter(link => {
            // Handle both cases: when source/target are objects or when they are IDs
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return sourceId === clickedNode.id || targetId === clickedNode.id;
        });

        // Log the weights of the edges connected to the clicked node
        console.log(`Edges connected to node ${clickedNode.id}:`);
        connectedLinks.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            console.log(`Edge from ${sourceId} to ${targetId} has weight ${link.weight}`);
        });
    }
}


function dragStarted(event, d) {
    if (!event.active) window.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d) {
    if (!event.active) window.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

export function constructGraphData(articles) {
    // Create nodes for each article
    const nodes = articles.map(article => ({
        id: article.id, // Use the UUID as the node ID
        title: article.title,
        color: article.feedColor, // This assumes feedColor is provided
    }));

    // Create links between all nodes (initially without weights)
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            links.push({
                source: nodes[i].id,
                target: nodes[j].id,
                weight: 0 // Initialize with a default weight of 0
            });
        }
    }

    return { nodes, links };
}

export function clearGraph() {
    // Stop the simulation if it's running
    if (window.simulation) {
        window.simulation.stop();
        window.simulation = null; // Clear the reference to the simulation
    }

    // Clear the contents of the SVG element without removing it
    d3.select('#graphcontent').select('svg').selectAll('*').remove();
}



export async function updateGraphForSelectedFeeds(articlesCache, similarityMatrix = null) {
    logger.log('Articles cache:', articlesCache); // Log the entire articlesCache

    const selectedFeedsElements = document.querySelectorAll('#feedslist div.clicked');
    logger.log('Selected Feeds Elements:', selectedFeedsElements); // Log the selected feeds elements

    let allArticles = [];
    selectedFeedsElements.forEach(feedElement => {
        const feedId = feedElement.id;
        if (articlesCache[feedId]) {
            // Map over articles, keeping failed fetches with empty fields
            const articlesWithFallbacks = articlesCache[feedId].map(article => ({
                id: article.id || '', // Use the UUID as the article ID or an empty string
                title: article.title || '',
                feedColor: article.feedColor || '',
                content: article.content || ''
            }));
            allArticles = allArticles.concat(articlesWithFallbacks);
        }
    });

    if (allArticles.length > 0) {
        const graphData = constructGraphData(allArticles);
        // If a similarity matrix is provided, update the weights of the edges
        if (similarityMatrix) {
            updateGraphEdgesWithSimilarityMatrix(graphData, similarityMatrix);
        }
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
        const sourceIndex = idToIndexMap.get(link.source);
        const targetIndex = idToIndexMap.get(link.target);

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