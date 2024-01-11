import * as d3 from 'd3';
import {
    forceAtlas2,
    defaultSettings
} from './ForceAtlas2/forceAtlas.js';

let svgContainer, graphGroup, simulation, defsContainer; // Define svg, g, and simulation at the top level so they can be reused
let currentTransform = d3.zoomIdentity;


function defineZoomBehavior(initialTransform) {
    const zoomBehavior = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            currentTransform = event.transform;
            graphGroup.attr("transform", currentTransform);
        })
        .filter(event => {
            return (event.button === 2 || event.type === 'wheel') && !event.ctrlKey;
        });

    svgContainer.call(zoomBehavior)
        .on('contextmenu', event => event.preventDefault());

    svgContainer.call(zoomBehavior.transform, initialTransform);
}


function setupSVGContainer(graphContainer, width, height) {
    if (!svgContainer) {
        svgContainer = graphContainer.append("svg")
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        graphGroup = svgContainer.append("g");
        defsContainer = svgContainer.append('defs');
    } else {
        graphGroup.selectAll('*').remove();
        defsContainer.selectAll('*').remove();
    }
}



function createNodes(graphData) {
    const nodes = graphGroup.selectAll('circle')
        .data(graphData.nodes, d => d.id)
        .enter()
        .append('circle')
        .attr('r', 5)
        .attr('fill', d => d.color);

    // Add any additional node attributes or event listeners here
}

function createLinks(graphData) {
    const links = graphGroup.selectAll('line')
        .data(graphData.links, d => `${d.source.id}-${d.target.id}`)
        .enter()
        .append('line')
        .attr('stroke-width', 0.3)
        .attr('stroke-opacity', 0.2)
        .attr('stroke', d => `url(#gradient-${d.source.id}-${d.target.id})`);

    // Add any additional link attributes or event listeners here
}


function createLinkGradients(graphData, defsContainer) {
    // Create a gradient for each link
    const gradients = defsContainer.selectAll('linearGradient')
        .data(graphData.links, d => `gradient-${d.source.id}-${d.target.id}`);

    gradients.enter()
        .append('linearGradient')
        .attr('id', d => `gradient-${d.source.id}-${d.target.id}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
        .each(function(d) {
            const gradient = d3.select(this);
            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', d.source.color);
            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', d.target.color);
        });

    gradients.exit().remove();
}

function createVisualElements(graphData) {
    createNodes(graphData);
    createLinks(graphData);
    createLinkGradients(graphData, defsContainer); // Call the helper function to create gradients

    // Call any additional functions for creating other visual elements like labels or markers
}


function updateNodes(graphData) {
    const nodes = graphGroup.selectAll('circle')
        .data(graphData.nodes, d => d.id);

    nodes.enter()
        .append('circle')
        .attr('r', 5)
        .attr('fill', d => d.color)
        .merge(nodes)
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

    nodes.exit().remove();
}

function updateLinks(graphData) {
    const links = graphGroup.selectAll('line')
        .data(graphData.links, d => `${d.source.id}-${d.target.id}`);

    links.enter()
        .append('line')
        .attr('stroke-width', 0.3)
        .attr('stroke-opacity', 0.2)
        .merge(links)
        .attr('stroke', d => `url(#gradient-${d.source.id}-${d.target.id})`)
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

    links.exit().remove();
}

function updateGradients(graphData) {
    // Update the gradients for the links
    graphData.links.forEach((link) => {
        const gradientId = `gradient-${link.source.id}-${link.target.id}`;
        const gradient = defsContainer.select(`#${gradientId}`);

        gradient.attr('x1', link.source.x)
            .attr('y1', link.source.y)
            .attr('x2', link.target.x)
            .attr('y2', link.target.y);
    });
}

function updateVisualization(graphData) {
    updateNodes(graphData);
    updateLinks(graphData);
    updateGradients(graphData);
}


function initializeForceSimulation(graphData, width, height) {
    const nodes = graphData.nodes;
    const links = graphData.links;

    simulation = d3.forceSimulation(nodes)
        // Comment out or remove the forces you don't want D3 to handle
        // .force('link', d3.forceLink(links).id(d => d.id))
        .force('charge', d3.forceManyBody())
        .force('center', d3.forceCenter(0, 0));

    simulation.on('tick', () => {
        // Call forceAtlas2 to calculate the positions
        forceAtlas2(simulation.alpha(), defaultSettings, nodes, links);

        // Update the positions of the nodes in the D3 selection
        graphGroup.selectAll('circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        // Update the positions of the links if necessary
        graphGroup.selectAll('line')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        // Call any other update functions necessary for your visualization
        updateVisualization(graphData);
    });
}


function applyDragBehavior(simulation) {
    const drag = d3.drag()
        .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
        .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
        })
        .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        });

    graphGroup.selectAll('circle').call(drag);
}







function visualizeGraph(graphData) {
    const width = 800;
    const height = 600;
    const graphContainer = d3.select('#graph-container');
    let initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(1);

    setupSVGContainer(graphContainer, width, height);
    defineZoomBehavior(initialTransform);
    initializeForceSimulation(graphData, width, height);
    createVisualElements(graphData);
    applyDragBehavior(simulation);

    // Apply the initial transform to the graph group to center the graph
    // This should be done after the simulation and visual elements are set up
    graphGroup.attr("transform", initialTransform);
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
export { visualizeGraph, clearGraph };