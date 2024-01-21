import Graph from "graphology";
import Sigma from "sigma";
import chroma from "chroma-js";
import { v4 as uuid } from "uuid";
import ForceSupervisor from "graphology-layout-force/worker";
import { pointArticleFromNode } from "../Feeds/ui/FeedUI";
// import ForceSupervisor from 'graphology-layout-forceatlas2/worker';

class SigmaGraphManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found.`);
        }

        this.graph = new Graph();
        this.renderer = new Sigma(this.graph, this.container, {
            labelThreshold: 0, // seemingly higher means less clutter
            enableHovering: false, // Disable built-in hover behavior
            renderLabels: true, // Disable automatic label rendering   
            allowInvalidContainer: true, //shusshes cypress         
        });
        this.draggedNode = null;
        this.isDragging = false;
        this.settings = {
            isNodeFixed: (_, attr) => attr.highlighted,
            strongGravityMode: false,
            gravity: 1,
            scalingRatio: 2,
            adjustSizes: true, // Nodes do not overlap
            barnesHutOptimize: true,
            barnesHutTheta: 1.2,
            repulsionStrength: 100, // Lower this value to reduce repulsion
        };

        this.startLayout();
        this.initializeInteractions();
    }

    initializeInteractions() {
        this.renderer.on("downNode", (e) => {
            this.isDragging = true;
            this.draggedNode = e.node;
            this.graph.setNodeAttribute(this.draggedNode, "highlighted", true);
        });

        // On mouse move, if the drag mode is enabled, we change the position of the draggedNode
        this.renderer.getMouseCaptor().on("mousemovebody", (e) => {
            if (!this.isDragging || !this.draggedNode) return;

            // Get new position of node
            const pos = this.renderer.viewportToGraph(e);

            this.graph.setNodeAttribute(this.draggedNode, "x", pos.x);
            this.graph.setNodeAttribute(this.draggedNode, "y", pos.y);

            // Prevent sigma to move camera:
            e.preventSigmaDefault();
            e.original.preventDefault();
            e.original.stopPropagation();
        });

        // On mouse up, we reset the autoscale and the dragging mode
        this.renderer.getMouseCaptor().on("mouseup", () => {
            if (this.draggedNode) {
                this.graph.removeNodeAttribute(this.draggedNode, "highlighted");
            }
            this.isDragging = false;
            this.draggedNode = null;
        });

        // Disable the autoscale at the first down interaction
        this.renderer.getMouseCaptor().on("mousedown", () => {
            if (!this.renderer.getCustomBBox()) this.renderer.setCustomBBox(this.renderer.getBBox());
        });


        this.renderer.on('clickNode', (e) => {
            console.log('Node clicked:', e.node);
            this.updateRightPanelWithFeed(e.node);
        });


        // this.renderer.on('enterNode', (e) => {
        //     const node = e.node;
        //     const nodeAttributes = this.graph.getNodeAttributes(node);
        //     this.showTooltip(nodeAttributes.title, e.event, nodeAttributes.color);
        // });

        // this.renderer.on('leaveNode', () => {
        //     this.hideTooltip();
        // });

        // this.renderer.on("clickStage", (event) => {
        //     // Sigma (ie. graph) and screen (viewport) coordinates are not the same.
        //     // So we need to translate the screen x & y coordinates to the graph one by calling the sigma helper `viewportToGraph`
        //     const coordForGraph = this.renderer.viewportToGraph({ x: event.x, y: event.y });

        //     // We create a new node
        //     const node = {
        //         ...coordForGraph,
        //         size: 10,
        //         color: chroma.random().hex(),
        //     };

        //     // Searching the two closest nodes to auto-create an edge to it
        //     const closestNodes = this.graph
        //         .nodes()
        //         .map((nodeId) => {
        //             const attrs = this.graph.getNodeAttributes(nodeId);
        //             const distance = Math.pow(node.x - attrs.x, 2) + Math.pow(node.y - attrs.y, 2);
        //             return { nodeId, distance };
        //         })
        //         .sort((a, b) => a.distance - b.distance)
        //         .slice(0, 2);

        //     // We register the new node into graphology instance
        //     const id = uuid();
        //     this.graph.addNode(id, node);

        //     // We create the edges
        //     closestNodes.forEach((e) => this.graph.addEdge(id, e.nodeId));
        // });

        // Initialize tooltips

        //this.initializeTooltips();
    }


    updateRightPanelWithFeed(nodeId) {
        // console.log('Node clicked:', nodeId);
        const nodeData = this.graph.getNodeAttributes(nodeId);
        const hslColorString = nodeData.colorhsl;
        pointArticleFromNode(hslColorString, nodeId);
    }


    // showTooltip(label, { x, y }, color) {
    //     const tooltip = document.getElementById('tooltip');
    //     tooltip.innerHTML = label;
    //     // Temporarily show the tooltip to calculate its width
    //     tooltip.style.visibility = 'visible';
    //     tooltip.style.position = 'absolute';
    //     tooltip.style.whiteSpace = 'nowrap';
    //     const tooltipWidth = tooltip.offsetWidth;
    //     // Hide the tooltip again to prevent flicker
    //     tooltip.style.visibility = 'hidden';

    //     tooltip.style.top = (y - 20) + 'px'; // Offset from the top of the cursor
    //     tooltip.style.left = (x + 5 + tooltipWidth) + 'px'; // Adjust for the tooltip's width
    //     tooltip.style.backgroundColor = color;
    //     tooltip.style.padding = '5px';
    //     tooltip.style.borderRadius = '4px';
    //     tooltip.style.color = 'black'; // Set text color to black
    //     tooltip.style.pointerEvents = 'none'; // Ensure the tooltip doesn't interfere with mouse events
    //     // Finally, show the tooltip with the correct position
    //     tooltip.style.visibility = 'visible';
    // }

    // hideTooltip() {
    //     const tooltip = document.getElementById('tooltip');
    //     tooltip.style.visibility = 'hidden';
    // }

    // Assuming the color is a string like "hsl(11884488.235294117, 60%, 85%)", convert it to a valid HSL string using Chroma.js
    getColorFromString(color) {
        // Extract the hue, saturation, and lightness components from the color string
        const hslMatch = color.match(/hsl\(([^,]+),\s*([^,]+)%,\s*([^,]+)%\)/);
        if (!hslMatch) {
            console.error('Invalid HSL color string:', color);
            return '#000'; // Fallback to black if the color string is invalid
        }

        // Normalize the hue to be between 0 and 360
        const rawHue = parseFloat(hslMatch[1]);
        const hue = rawHue % 360;
        const saturation = parseFloat(hslMatch[2]);
        const lightness = parseFloat(hslMatch[3]);

        // console.log("Hue:", hue, "Saturation:", saturation, "Lightness:", lightness);

        // Use Chroma.js to construct a valid HSL color
        const hslColor = chroma.hsl(hue, saturation / 100, lightness / 100).css();
        return hslColor;
    }

    getStringFromColor(color) {
        // Convert the Chroma.js color object to HSL and destructure it into components
        const [hue, saturation, lightness] = chroma(color).hsl();
    
        // Normalize the hue to be between 0 and 360
        const normalizedHue = hue % 360;
    
        // Construct a valid HSL color string
        const hslColorString = `hsl(${normalizedHue}, ${saturation * 100}%, ${lightness * 100}%)`;
        return hslColorString;
    }

    // Update the getNodeAttributes method to use the new color conversion
    getNodeAttributes(node) {
        return {
            x: node.x,
            y: node.y,
            size: node.size || 10,
            color: this.getColorFromString(node.color),
            colorhsl : node.color,
            label: node.title,
            title: node.title
        };
    }



    // Correct the closest node calculation
    getClosestNodes(coordForGraph, count = 2) {
        return this.graph
            .nodes()
            .map(nodeId => {
                const attrs = this.graph.getNodeAttributes(nodeId);
                const distance = Math.pow(coordForGraph.x - attrs.x, 2) + Math.pow(coordForGraph.y - attrs.y, 2);
                return { nodeId, distance };
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count);
    }







    // Add methods to add nodes, edges, update the graph, etc.
    addNode(attributes) {
        const id = uuid();
        this.graph.addNode(id, attributes);
        return id;
    }

    addEdge(sourceId, targetId) {
        this.graph.addEdge(sourceId, targetId);
    }






    updateGraph(newGraphData) {
        // Create sets for quick lookup
        const existingNodesSet = new Set(this.graph.nodes());
        const existingEdgesSet = new Set(this.graph.edges());

        const center = { x: 0, y: 0 }; // Adjust this if your graph's center is different
        const radius = 0.05; // Small radius around the center for initial node placement
        const defaultNodeSize = 10; // Default size for new nodes

        // Add new nodes around the center with weak edges
        newGraphData.nodes.forEach(node => {
            if (!existingNodesSet.has(node.id)) {
                // Randomize position around the center within the defined radius
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * radius;
                const attributes = this.getNodeAttributes(node);
                attributes.x = center.x + distance * Math.cos(angle);
                attributes.y = center.y + distance * Math.sin(angle);

                // Set default size for new nodes
                attributes.size = defaultNodeSize;

                // Add node with weak edge strength
                attributes.edgeStrength = 0.1; // Custom attribute for edge strength
                this.graph.addNode(node.id, attributes);

                // Animate edge strength from weak to full over 3 seconds
                const animateEdgeStrength = (startTime, nodeId) => {
                    const currentTime = Date.now();
                    const elapsedTime = currentTime - startTime;
                    const duration = 1000; // 3 seconds

                    if (elapsedTime < duration) {
                        const progress = elapsedTime / duration;
                        const edgeStrength = 0.1 + (progress * (1 - 0.1)); // Animate from 0.1 to 1

                        // Update edge strength for all edges connected to the new node
                        this.graph.forEachEdge(nodeId, (edge) => {
                            this.graph.setEdgeAttribute(edge, 'edgeStrength', edgeStrength);
                        });

                        requestAnimationFrame(() => animateEdgeStrength(startTime, nodeId));
                    }
                };

                // Start the edge strength animation
                const startTime = Date.now();
                requestAnimationFrame(() => animateEdgeStrength(startTime, node.id));
            }
        });

        // Remove nodes that are no longer present
        existingNodesSet.forEach(nodeId => {
            if (!newGraphData.nodes.some(node => node.id === nodeId)) {
                // Before removing the node, remove all connected edges
                this.graph.forEachEdge(nodeId, edge => {
                    this.graph.dropEdge(edge);
                    existingEdgesSet.delete(edge); // Update the existing edges set
                });
                // Now it's safe to remove the node
                this.graph.dropNode(nodeId);
            }
        });

        // Add new edges
        newGraphData.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const edgeKey = `${sourceId}-${targetId}`;

            if (!existingEdgesSet.has(edgeKey)) {
                const sourceColor = this.graph.getNodeAttribute(sourceId, 'color');
                const targetColor = this.graph.getNodeAttribute(targetId, 'color');

                // Calculate the average color of the two nodes
                const averageColor = chroma.mix(sourceColor, targetColor, 0.5, 'rgb').hex();
                this.graph.addEdgeWithKey(edgeKey, sourceId, targetId, {
                    size: link.size || 1,
                    color: averageColor,
                });
            }
        });

        // // After adding nodes and edges, fit the graph to view
        // this.renderer.on('afterRender', () => {
        //     this.renderer.getCamera().animatedReset();
        // });

        // Remove edges that are no longer present
        existingEdgesSet.forEach(edge => {
            if (this.graph.hasEdge(edge)) { // Check if the edge still exists
                const [sourceId, targetId] = this.graph.extremities(edge);
                if (!newGraphData.links.some(link => {
                    const linkSourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const linkTargetId = typeof link.target === 'object' ? link.target.id : link.target;
                    return (sourceId === linkSourceId && targetId === linkTargetId) || (sourceId === linkTargetId && targetId === linkSourceId);
                })) {
                    this.graph.dropEdge(edge);
                }
            }
        });

        // Refresh the Sigma renderer to reflect the changes
        this.renderer.refresh();
    }

    clearGraph() {
        // Clear the graph and refresh the renderer
        this.graph.clear();
        this.renderer.refresh();
    }

    startLayout() {
        console.log('Starting layout with settings:', this.settings);
        if (this.layout) {
            this.layout.stop();
            console.log('Previous layout stopped.');
        }
        this.layout = new ForceSupervisor(this.graph, this.settings);
        console.log('New ForceSupervisor created. with settings:', this.settings);
        this.layout.start();
        console.log('Layout started.');
    }

    stopLayout() {
        if (this.layout) {
            this.layout.stop();
        }
    }


    updateForceSettings(settings) {
        // console.log("Before update:", this.settings);
        this.stopLayout(); // Stop the existing layout
        this.settings = { ...this.settings, ...settings }; // Update the settings
        this.startLayout();
        this.renderer.refresh();
        // console.log("After update:", this.settings);
    }
}

let graphS;

function visualizeGraph(newGraphData) {
    if (!graphS) {
        graphS = new SigmaGraphManager('graph-container');
    }
    graphS.updateGraph(newGraphData);
}

function clearGraph() {
    graphS.clearGraph();
}

function updateForceSettings(settings) {
    graphS.updateForceSettings(settings);
}

export { visualizeGraph, clearGraph, updateForceSettings };