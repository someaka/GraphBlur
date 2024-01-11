import { forceAtlas2 } from './forceAtlas.js';
import { QuadTree, buildQuadTree } from './quadTree.js';
//import * as d3 from 'd3';

// Define the width and height of the graph
const width = 800, height = 600;

// Example nodes and edges with different weights and links
const nodes = [
    { id: 'n1', x: width / 2, y: height / 2, vx: 0, vy: 0, degree: 1 },
    { id: 'n2', x: width / 3, y: height / 3, vx: 0, vy: 0, degree: 1 },
    { id: 'n3', x: width / 4, y: height / 4, vx: 0, vy: 0, degree: 1 }, // Additional node
    { id: 'n4', x: width / 5, y: height / 5, vx: 0, vy: 0, degree: 1 }  // Additional node
];
const edges = [
    { source: 'n1', target: 'n2', weight: 1 },
    { source: 'n2', target: 'n3', weight: 2 }, // Additional link with different weight
    { source: 'n3', target: 'n4', weight: 3 }  // Additional link with different weight
];

// Define the simulation
const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id(d => d.id))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(width / 2, height / 2))
    .on('tick', ticked);

// Define drag behavior
const drag = d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);

function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

function ticked() {
  // Update node and link positions each tick of the simulation
  svg.selectAll('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);

  // If you have SVG lines for links, update their positions here
}

// Select the SVG element and set its width and height
const svg = d3.select('#graph').attr('width', width).attr('height', height);

// Create the SVG circles for the nodes and call the drag behavior
svg.selectAll('circle')
  .data(nodes)
  .enter()
  .append('circle')
  .attr('cx', d => d.x)
  .attr('cy', d => d.y)
  .attr('r', 5)
  .attr('fill', 'red')
  .call(drag); // Attach the drag behavior to the circles

// ... (the rest of your code to create the visualization)