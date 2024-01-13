import * as d3 from 'd3';
import { 
    graphGroup, 
    defsContainer,
    setGraphGroup, 
    setDefsContainer 
} from './visualizeGraph';

let svgContainer
let currentTransform = d3.zoomIdentity;


function setupSVGContainer(selector, width, height) {
    const graphContainer = d3.select(selector);
    if (!graphContainer.node()) {
        console.error(`The DOM element with selector "${selector}" was not found.`);
        return;
    }

    // Check if the SVG container already exists
    svgContainer = graphContainer.select("svg");
    if (svgContainer.empty()) {
        svgContainer = graphContainer.append("svg")
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Use the setter functions to set graphGroup and defsContainer
        setGraphGroup(svgContainer.append("g"));
        setDefsContainer(svgContainer.append('defs'));
    }
}


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

export { defineZoomBehavior, applyDragBehavior, setupSVGContainer };