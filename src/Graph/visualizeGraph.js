import { visualGraphLogger as logger } from '../logger.js';

import * as d3 from 'd3';
import { forceAtlas2, defaultSettings, initializeGraphElements } from '../ForceAtlas2/forceAtlas.js';
import { defineZoomBehavior, applyDragBehavior, setupSVGContainer } from './graphInteraction.js';
import { createVisualElements, updateVisualization } from './graphElements.js';


let graphGroup, simulation, defsContainer;

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

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
        forceAtlas2(simulation.alpha(), currentForceAtlas2Settings, graphData.nodes, graphData.links);
        updateVisualization(graphData);
    } catch (error) {
        logger.error('Simulation tick failed:', error);
        stopSimulation();
    }
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





function visualizeGraph(newGraphData, selector = '#graph-container') {
    // Stop the existing simulation if it's running
    stopSimulation();

    // Update the global graphData with the new data
    graphData = newGraphData;
    const { width, height } = getGraphContainerDimensions(selector);

    // Update the forceAtlas2 settings with the new dimensions
    updateForceAtlas2Settings({ width, height });

    // Setup the SVG container and define zoom behavior
    setupSVGContainer(selector, width, height);
    defineZoomBehavior(d3.zoomIdentity);

    // Initialize the force simulation with the new graph data
    initializeForceSimulation(graphData);

    // Create visual elements (nodes, links, etc.)
    createVisualElements(graphData);

    // Reapply the drag behavior to the new nodes
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
    constructGraphData,
    visualizeGraph,
    clearGraph,
    setGraphGroup,
    setDefsContainer,
    updateForceAtlas2Settings,
    graphGroup,
    simulation,
    defsContainer
};
