import { forceAtlas2, defaultSettings } from './forceAtlas.js';
// import * as d3 from 'd3';

// Define the width and height of the graph
const width = 800, height = 600;

// Expanded example nodes and edges with different weights and links
const nodes = [
  { id: 'n1', x: width / 2, y: height / 2, vx: 0, vy: 0, degree: 1 },
  { id: 'n2', x: width / 3, y: height / 3, vx: 0, vy: 0, degree: 1 },
  { id: 'n3', x: width / 4, y: height / 4, vx: 0, vy: 0, degree: 1 },
  { id: 'n4', x: width / 5, y: height / 5, vx: 0, vy: 0, degree: 1 },
  // Additional nodes
  { id: 'n5', x: width / 6, y: height / 6, vx: 0, vy: 0, degree: 1 },
  { id: 'n6', x: width / 7, y: height / 7, vx: 0, vy: 0, degree: 1 }
];

// Create a map for quick ID to node lookup
const nodeById = new Map(nodes.map(node => [node.id, node]));

// Expanded edges to reference node objects instead of IDs
const edges = [
  { source: nodeById.get('n1'), target: nodeById.get('n2'), weight: 1 },
  { source: nodeById.get('n2'), target: nodeById.get('n3'), weight: 2 },
  { source: nodeById.get('n3'), target: nodeById.get('n4'), weight: 3 },
  // Additional edges
  { source: nodeById.get('n4'), target: nodeById.get('n5'), weight: 1 },
  { source: nodeById.get('n5'), target: nodeById.get('n6'), weight: 2 },
  { source: nodeById.get('n6'), target: nodeById.get('n1'), weight: 3 } // This creates a loop back to n1
];

// Define the simulation
const simulation = d3.forceSimulation(nodes)
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
  // Call forceAtlas2 to calculate the positions
  forceAtlas2(simulation.alpha(), defaultSettings, nodes, edges);

  // Update node and link positions each tick of the simulation
  svg.selectAll('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);

  svg.selectAll('line')
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);
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

