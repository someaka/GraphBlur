import * as d3 from 'd3';
import { graphGroup, defsContainer } from './visualizeGraph';

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
        .each(function (d) {
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
    createLinks(graphData);
    createNodes(graphData);
    createLinkGradients(graphData, defsContainer);
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

export { createVisualElements, updateVisualization };