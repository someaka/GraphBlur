import { visualGraphLogger as logger } from '../logger.js';

import * as d3 from 'd3';
import { forceAtlas2, defaultSettings } from '../ForceAtlas2/forceAtlas.js';
import { defineZoomBehavior, applyDragBehavior, setupSVGContainer } from './graphInteraction.js';
import { createVisualElements, updateVisualization } from './graphElements.js';


let graphGroup, simulation, defsContainer;


let currentForceAtlas2Settings = { ...defaultSettings };

let graphData = {
    nodes: [],
    links: []
};

// Setter function for graphGroup
function setGraphGroup(group) {
    graphGroup = group;
}

// Setter function for defsContainer
function setDefsContainer(container) {
    defsContainer = container;
}

function getGraphContainerDimensions(selector) {
    const graphContainer = d3.select(selector);
    const width = graphContainer.node().getBoundingClientRect().width;
    const height = graphContainer.node().getBoundingClientRect().height;
    return { width, height };
}


function initializeForceSimulation(graphData) {
    sanitizeNodeData(graphData.nodes);
    setupSimulation(graphData.nodes);
}

function sanitizeNodeData(nodes) {
    const width = currentForceAtlas2Settings.width;
    const height = currentForceAtlas2Settings.height;
    nodes.forEach(node => {
        node.x = isNaN(node.x) ? width / 2 : node.x;
        node.y = isNaN(node.y) ? height / 2 : node.y;
    });
}

function setupSimulation(nodes) {
    simulation = d3.forceSimulation(nodes)
        .alphaMin(0.001)
        .alphaTarget(0.3)
        .on('tick', ticked);

    // Uncomment and configure these forces as needed
    // simulation.force('link', d3.forceLink(links).id(d => d.id).distance(5).strength(1));
    // simulation.force('charge', d3.forceManyBody().strength(-1));
    // simulation.force('center', d3.forceCenter(width / 2, height / 2));
}

function ticked() {
    if (!simulation) {
        logger.error("Simulation is null during ticked function.");
        return;
    }
    try {
        calculateDegrees(graphData);

        forceAtlas2(simulation.alpha(), currentForceAtlas2Settings, graphData.nodes, graphData.links);
        //console.log("prettified JSON graphData", JSON.stringify(graphData, null, 2));
        updateVisualization(graphData);
    } catch (error) {
        logger.error('Simulation tick failed:', error);
        stopSimulation();
    }
}



function calculateDegrees(graphData) {
    const { nodes, links } = graphData;
    // Initialize all degrees to 1 (to account for self-similarity)
    const degrees = new Map(nodes.map(node => [node.id, 1]));

    // Sum the weights of the links for each node
    links.forEach(link => {
        degrees.set(link.source.id, degrees.get(link.source.id) + link.weight);
        degrees.set(link.target.id, degrees.get(link.target.id) + link.weight);
    });

    // Assign the calculated degree back to the node objects
    nodes.forEach(node => {
        node.degree = degrees.get(node.id);
        node.mass = node.degree;
    });
}







function isValidNode({ id, x, y }) {
    return typeof id !== 'undefined' && !isNaN(x) && !isNaN(y);
}

function isValidLink({ source, target }, nodes) {
    const nodeIds = new Set(nodes.map(node => node.id));
    return source && target &&
        typeof source.id !== 'undefined' &&
        typeof target.id !== 'undefined' &&
        nodeIds.has(source.id) && nodeIds.has(target.id);
}

function verifyNodes(nodes) {
    if (!Array.isArray(nodes)) {
        throw new Error('The "nodes" parameter must be an array.');
    }

    nodes.forEach(node => {
        if (!isValidNode(node)) {
            throw new Error(`Invalid node detected: ${JSON.stringify(node)}`);
        }
    });
}

function verifyLinks(links, nodes) {
    if (!Array.isArray(links)) {
        throw new Error('The "links" parameter must be an array.');
    }

    links.forEach(link => {
        if (!isValidLink(link, nodes)) {
            throw new Error(`Invalid link detected: ${JSON.stringify(link)}`);
        }
    });
}

function verifyForceAtlas2Parameters(graphData) {
    const { nodes, links } = graphData;
    verifyNodes(nodes);
    verifyLinks(links, nodes);
}






function visualizeGraph(newGraphData, selector = '#graph-container') {
    graphData = newGraphData;
    stopSimulation();

    const { width, height } = getGraphContainerDimensions(selector);

    updateForceAtlas2Settings({ width, height });
    setupSVGContainer(selector, width, height);
    defineZoomBehavior(d3.zoomIdentity);
    calculateDegrees(graphData);
    verifyForceAtlas2Parameters(graphData);
    initializeForceSimulation(graphData);
    createVisualElements(graphData);
    applyDragBehavior(simulation);
}


function stopSimulation() {
    if (simulation) {
        simulation.on('tick', null); // Remove tick event
        simulation.stop(); // Stop the simulation
        simulation = null; // Set simulation to null to prevent future errors
    }
}

function clearGraph() {
    stopSimulation();

    // Clear the contents of the SVG element without removing it
    if (graphGroup) {
        graphGroup.selectAll('*').remove();
    }
}




// Function to update the forceAtlas2 settings with new parameters
function updateForceAtlas2Settings(newParams, settings = currentForceAtlas2Settings) {
    // Merge new parameters with the provided settings
    currentForceAtlas2Settings = {
        ...settings,
        ...newParams
    };
    // logger.log("Force parameters updated with:", JSON.stringify(currentForceAtlas2Settings));

    if (simulation) {
        // Use the currentForceAtlas2Settings to update the simulation
        forceAtlas2(simulation.alpha(), currentForceAtlas2Settings, graphData.nodes, graphData.links);

        logger.log("Force simulation updated with:", currentForceAtlas2Settings);
        // Restart the simulation for the changes to take effect
        simulation.alpha(1).restart();
    }
}



export {
    visualizeGraph,
    clearGraph,
    setGraphGroup,
    setDefsContainer,
    updateForceAtlas2Settings,
    graphGroup,
    simulation,
    defsContainer
};
