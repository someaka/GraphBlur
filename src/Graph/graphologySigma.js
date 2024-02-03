import { graphLogger as logger } from '../logger.js';

import Graph from "graphology";
import Sigma from "sigma";
import { v4 as uuid } from "uuid";
import ForceSupervisor from "graphology-layout-force/worker";
import { pointArticleFromNode } from "../Feeds/ui/FeedUI";
// import ForceSupervisor from 'graphology-layout-forceatlas2/worker';

//const CHUNK_SIZE = 1000;


class SigmaGrapUpdate {
    /**
     * @type {SigmaGrapUpdate | null}
     */
    static instance = null;

    static getInstance() {
        if (!this.instance) {
            this.instance = new SigmaGrapUpdate();
        }
        return this.instance;
    }



    constructor() {
        const containerId = 'graph-container';
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found.`);
        }

        this.graph = new Graph();
        this.renderer = new Sigma(this.graph, this.container, {


            renderLabels: true, // Disable automatic label rendering   
            allowInvalidContainer: true, //shusshes cypress
            labelDensity: 1,
            labelGridCellSize: 150,
            // labelRenderedSizeThreshold: 5, // affects label for node size
            // nodeProgramClasses: {
            //     border: NodeProgramBorder,
            // },
        });
        this.defaultDrawHover = this.renderer.getSetting("defaultDrawNodeHover");
        this.draggedNode = null;
        this.isDragging = false;
        // TODO set up forceatlas2 and different settings for each layout
        this.settings = {
            isNodeFixed: (_, attr) => attr.highlighted,
            settings: {
                attraction: 0.00001,
                repulsion: 0.2,
                gravity: 0.0001,
                inertia: 0.6,
                maxMove: 5
            }
        };
        this.layout = new ForceSupervisor(this.graph, this.settings);
        this.DayOrNight = 1;

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
            logger.log('Node clicked:', e.node);
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
        // logger.log('Node clicked:', nodeId);
        const nodeData = this.graph.getNodeAttributes(nodeId);
        pointArticleFromNode(nodeData.color, nodeId);
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



    // Update the getNodeAttributes method to use the new color conversion
    getNodeAttributes(node) {
        return {
            x: node.x,
            y: node.y,
            size: node.size || 10,
            color: node.color,
            // borderColor: chroma(data.color).darken().hex(),
            // borderSize: 2,
            // type: "border",
            // colorhsl: node.color,
            label: node.title,
            title: node.title,
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
        //const existingNodesSet = new Set(this.graph.nodes());
        //const existingEdgesSet = new Set(this.graph.edges());

        // Create sets for quick lookup
        const newNodesSet = new Set(newGraphData.nodes.map(node => node.id));
        //const newEdgesSet = new Set(newGraphData.links.map(link => `${link.source.id}_${link.target.id}`));

        try {
            //this.layout.stop();
            // await this.removeEdges(existingEdgesSet, newEdgesSet);
            this.graph.clearEdges();
            this.removeNodes(newNodesSet);
            //this.layout.start();

            this.addNewNodes(newGraphData.nodes);
            this.addNewEdges(newGraphData.links);

            // Refresh the Sigma renderer to reflect the changes
            this.renderer.refresh();
        } catch {
            logger.warn("Failed to update graph")
        }
    }

    // async removeEdges(existingEdgesSet, newEdgesSet) {

    //     const edgesArray = Array.from(existingEdgesSet);
    //     const chunkSize = CHUNK_SIZE; // Adjust this value based on your needs

    //     for (let i = 0; i < edgesArray.length; i += chunkSize) {
    //         const chunk = edgesArray.slice(i, i + chunkSize);
    //         for (let edge of chunk) {
    //             if (this.graph.hasEdge(edge)) { // Check if the edge still exists
    //                 const [sourceId, targetId] = this.graph.extremities(edge);
    //                 const key = `${sourceId}_${targetId}`;
    //                 if (!newEdgesSet.has(key)) {
    //                     this.graph.dropEdge(edge);
    //                     existingEdgesSet.delete(edge); // Update the existing edges set
    //                 }
    //             }
    //         }
    //         //await new Promise(resolve => setTimeout(resolve, 0));
    //     }
    // }

    removeNodes(newNodesSet) {

        this.graph.forEachNode((nodeId) => {
            if (!newNodesSet.has(nodeId)) {
                this.graph.dropNode(nodeId);
            }
        })

    }



    addNewNodes(nodes) {
        const defaultNodeSize = 10; // Default size for new nodes

        for (let node of nodes) {
            if (!this.graph.hasNode(node.id)) {

                const attributes = this.getNodeAttributes(node);

                // Set default size for new nodes
                attributes.size = defaultNodeSize;

                // Add node with weak edge strength
                //attributes.edgeStrength = 0.1; // Custom attribute for edge strength
                this.graph.addNode(node.id, attributes);

                //this.animateEdgeStrength(node.id);
            }
        }


    }



    // addNewNodes(nodes, existingNodesSet) {
    //     //const nodesArray = Array.from(nodes);


    //     const defaultNodeSize = 10; // Default size for new nodes
    //     const center = { x: 0, y: 0 }; // Adjust this if your graph's center is different
    //     const radius = 0.05; // Small radius around the center for initial node placement


    //     for (let node of nodes) {
    //         if (!existingNodesSet.has(node.id)) {
    //             // Randomize position around the center within the defined radius
    //             const angle = Math.random() * Math.PI * 2;
    //             const distance = Math.random() * radius;
    //             const attributes = this.getNodeAttributes(node);
    //             attributes.x = center.x + distance * Math.cos(angle);
    //             attributes.y = center.y + distance * Math.sin(angle);

    //             // Set default size for new nodes
    //             attributes.size = defaultNodeSize;

    //             // Add node with weak edge strength
    //             attributes.edgeStrength = 0.1; // Custom attribute for edge strength
    //             this.graph.addNode(node.id, attributes);

    //             this.animateEdgeStrength(node.id);
    //         }
    //     }


    // }



    addNewEdges(links) {
        for (let link of links) {
            const sourceId = link.source.id;
            const targetId = link.target.id;
            const edgeKey = `${sourceId}_${targetId}`;
            this.graph.addEdgeWithKey(edgeKey, sourceId, targetId, {
                size: link.size || 1,
                weight: link.weight || 1,
                color: this.DayOrNight ? link.day_color : link.night_color,
                day_color: link.day_color,
                night_color: link.night_color
            });
        }
    }


    // async addNewEdges(links, existingEdgesSet) {
    //     const linksArray = Array.from(links);
    //     const chunkSize = CHUNK_SIZE; // Adjust this value based on your needs

    //     for (let i = 0; i < linksArray.length; i += chunkSize) {
    //         const chunk = linksArray.slice(i, i + chunkSize);
    //         for (let link of chunk) {
    //             const sourceId = link.source.id;
    //             const targetId = link.target.id;
    //             const edgeKey = `${sourceId}_${targetId}`;
    //             const edgeKeyRev = `${targetId}_${sourceId}`;

    //             if (!existingEdgesSet.has(edgeKey) && !existingEdgesSet.has(edgeKeyRev)) {
    //                 const sourceColor = this.graph.getNodeAttribute(sourceId, 'color');
    //                 const targetColor = this.graph.getNodeAttribute(targetId, 'color');

    //                 // Calculate the average color of the two nodes
    //                 const averageColor = chroma.mix(sourceColor, targetColor, 0.5, 'rgb').brighten(0.77).hex();
    //                 this.graph.addEdgeWithKey(edgeKey, sourceId, targetId, {
    //                     size: link.size || 1,
    //                     color: averageColor,
    //                 });
    //             }
    //         }
    //         //await new Promise(resolve => setTimeout(resolve, 0));
    //     }
    // }

    animateEdgeStrength(nodeId) {
        // Animate edge strength from weak to full over 1 seconds
        const animateEdgeStrength = (startTime, nodeId) => {
            const currentTime = Date.now();
            const elapsedTime = currentTime - startTime;
            const duration = 1000; // 1 second

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
        requestAnimationFrame(() => animateEdgeStrength(startTime, nodeId));
    }














    clearGraph() {
        // Clear the graph and refresh the renderer
        this.graph.clear();
        this.renderer.refresh();
    }

    startLayout() {
        this.layout.start();
    }

    stopLayout() {
        if (this.layout.isRunning()) {
            this.layout.stop();
        }
    }


    updateForceSettings(newSettings) {
        this.stopLayout();

        this.settings.settings = { ...this.settings.settings, ...newSettings };

        this.layout = new ForceSupervisor(this.graph, this.settings);

        this.startLayout();
        this.renderer.refresh();
        logger.log('New ForceSupervisor created with settings:', this.settings);
    }

    updateDayNightMode() {
        if (this.DayOrNight === 0) {
            this.renderer.setSetting("labelColor", {
                //attribute: 'color'
                color: '#000000'
            });
            this.renderer.setSetting("defaultDrawNodeHover",
                this.defaultDrawHover || (() => {})
            );
            this.graph.forEachEdge((edge) => {
                this.graph.updateEdgeAttributes(edge, attr => {
                    attr.color = attr.day_color
                    return attr;
                });
            })

            this.DayOrNight = 1;
        } else if (this.DayOrNight === 1) {
            this.renderer.setSetting("labelColor", {
                //attribute: 'color'
                color: '#FFFFFF'
            });
            this.renderer.setSetting("defaultDrawNodeHover",
                // function that does nothing
                () => { }
            );
            this.graph.forEachEdge((edge) => {
                this.graph.updateEdgeAttributes(edge, attr => {
                    attr.color = attr.night_color
                    return attr;
                });
            })

            this.DayOrNight = 0;
        }
        this.renderer.refresh();
    }
}


const visualizeGraph = (newGraphData) => SigmaGrapUpdate.getInstance().updateGraph(newGraphData);
const updateForceSettings = (newSettings) => SigmaGrapUpdate.getInstance().updateForceSettings(newSettings);
const updateDayNightMode = () => SigmaGrapUpdate.getInstance().updateDayNightMode();
const clearGraph = () => SigmaGrapUpdate.getInstance().clearGraph();



export { visualizeGraph, clearGraph, updateForceSettings, updateDayNightMode };