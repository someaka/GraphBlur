import * as d3 from 'd3';
import { forceAtlas2, defaultSettings, initializeGraphElements } from '../ForceAtlas2/forceAtlas.js';
import { defineZoomBehavior, applyDragBehavior, setupSVGContainer } from './graphInteraction.js';
import { createVisualElements, updateVisualization } from './graphElements.js';


let graphGroup, simulation, defsContainer;

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

let currentForceAtlas2Settings = { ...defaultSettings };

// Function to update the forceAtlas2 settings with new parameters
function updateForceAtlas2Settings(newParams, settings = defaultSettings) {
    // Merge new parameters with the provided settings
    currentForceAtlas2Settings = {
        ...settings,
        ...newParams
    };
}

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


function initializeForceSimulation(graphData, forceAtlas2Settings) {
    const nodes = graphData.nodes;
    const links = graphData.links;
    const width = forceAtlas2Settings.width;
    const height = forceAtlas2Settings.height;

    // Sanitize node data
    nodes.forEach(node => {
        if (isNaN(node.x) || isNaN(node.y)) {
            node.x = width / 2;
            node.y = height / 2;
        }
    });

    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id)) // Set up the link force
        .force('charge', d3.forceManyBody())
        .force('center', d3.forceCenter(width / 2, height / 2));

    simulation.on('tick', () => {
        try {
            // Call forceAtlas2 to calculate the positions
            forceAtlas2(simulation.alpha(), forceAtlas2Settings, nodes, links);

            // Update the positions of the nodes in the D3 selection
            graphGroup.selectAll('circle')
                .attr('cx', d => isNaN(d.x) ? 0 : d.x)
                .attr('cy', d => isNaN(d.y) ? 0 : d.y);

            // Update the positions of the links if necessary
            graphGroup.selectAll('line')
                .attr('x1', d => isNaN(d.source.x) ? 0 : d.source.x)
                .attr('y1', d => isNaN(d.source.y) ? 0 : d.source.y)
                .attr('x2', d => isNaN(d.target.x) ? 0 : d.target.x)
                .attr('y2', d => isNaN(d.target.y) ? 0 : d.target.y);

            // Call any other update functions necessary for your visualization
            updateVisualization(graphData);
        } catch (error) {
            console.error('Simulation tick failed:', error);
            simulation.stop(); // Stop the simulation in case of error
        }
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






function visualizeGraph(graphData, selector = '#graph-container') {
    const { width, height } = getGraphContainerDimensions(selector);
    let initialTransform = d3.zoomIdentity;

    updateForceAtlas2Settings({ width, height });
    setupSVGContainer(selector, width, height);
    defineZoomBehavior(initialTransform);
    initializeForceSimulation(graphData, currentForceAtlas2Settings);
    createVisualElements(graphData);
    applyDragBehavior(simulation);

}


function clearGraph() {
    // Stop the simulation if it's running
    if (simulation) {
        simulation.stop();
        simulation = null; // Clear the reference to the simulation
    }

    // Clear the contents of the SVG element without removing it
    if (graphGroup) {
        graphGroup.selectAll('*').remove();
    }
}


function updateForceParameters() {
    if (simulation && simulation.force("link")) {
        // Use the currentForceAtlas2Settings to update the simulation
        forceAtlas2(simulation.alpha(), currentForceAtlas2Settings, simulation.nodes(), simulation.force("link").links());

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
    updateForceParameters,
    updateForceAtlas2Settings,
    graphGroup,
    simulation,
    defsContainer
};
