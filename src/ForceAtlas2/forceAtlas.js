import { forceAtlasLogger as logger } from '../logger.js';

import { buildQuadTree } from './quadTree.js';

const defaultSettings = {
    gravity: 0.001,
    scalingRatio: 2.0,
    edgeWeightInfluence: 1,
    dissuadeHubs: false,
    preventOverlap: true,
    barnesHutTheta: 1.2,
    repulsionStrength: 0.1,
    coolingRate: 0.1,
    width: 800, // Default layout width
    height: 600, // Default layout height
    nodeRadius: () => 5 // Default function for node radius
};



function initializeGraphElements(nodes, links, width = 800, height = 600) {
    // Check if width and height are numbers
    if (typeof width !== 'number' || isNaN(width)) {
        logger.error('Width is not a number:', width);
        width = 800; // Set a default width if invalid
    }
    if (typeof height !== 'number' || isNaN(height)) {
        logger.error('Height is not a number:', height);
        height = 600; // Set a default height if invalid
    }

    // Default initialization values for nodes
    const defaultX = width / 2;
    const defaultY = height / 2;
    const defaultVx = 0;
    const defaultVy = 0;

    // Initialize node properties with slight randomization to avoid zero distance
    nodes.forEach(node => {
        node.x = typeof node.x === 'number' && !isNaN(node.x) ? node.x : defaultX +(Math.random() - 0.5) * 10;
        node.y = typeof node.y === 'number' && !isNaN(node.y) ? node.y : defaultY +(Math.random() - 0.5) * 10;
        node.vx = typeof node.vx === 'number' && !isNaN(node.vx) ? node.vx : defaultVx;
        node.vy = typeof node.vy === 'number' && !isNaN(node.vy) ? node.vy : defaultVy;
    });

    // Log the node properties to confirm they are set correctly
    nodes.forEach(node => {
        logger.log(`Node initialized: ${JSON.stringify(node)}`);
    });

    // Default initialization value for link weights
    const defaultWeight = 1;

    // Initialize link weights
    links.forEach(link => {
        link.weight = typeof link.weight === 'number' && !isNaN(link.weight) ? link.weight : defaultWeight;
    });
}

function verifyForceAtlas2Parameters(nodes, edges) {
    // Verify nodes array
    if (!Array.isArray(nodes)) {
        throw new Error('The nodes parameter must be an array.');
    }
    for (const node of nodes) {
        if (typeof node.id === 'undefined') {
            throw new Error('Each node must have an id property.');
        }
    }

    // Verify edges array
    if (!Array.isArray(edges)) {
        throw new Error('The edges parameter must be an array.');
    }
    for (const edge of edges) {
        if (typeof edge.source !== 'object' || typeof edge.source.id === 'undefined') {
            throw new Error('Each edge must have a source property that is an object with an id.');
        }
        if (typeof edge.target !== 'object' || typeof edge.target.id === 'undefined') {
            throw new Error('Each edge must have a target property that is an object with an id.');
        }
        if (!nodes.some(n => n.id === edge.source.id)) {
            throw new Error(`Edge source id ${edge.source.id} does not correspond to any node id.`);
        }
        if (!nodes.some(n => n.id === edge.target.id)) {
            throw new Error(`Edge target id ${edge.target.id} does not correspond to any node id.`);
        }
    }
}


function forceAtlas2(alpha, customSettings, nodes, edges) {
    logger.log("Edges received in forceAtlas2:", edges);
    logger.log("Applying forceAtlas2 with settings:", JSON.stringify(customSettings));

    // Calculate degrees for nodes based on link weights
    calculateDegrees(nodes, edges);
    // Initialize node properties and link weights
    initializeGraphElements(nodes, edges, customSettings.width, customSettings.height);
    logger.log("Nodes and edges initialized", JSON.stringify(nodes), JSON.stringify(edges));
    // Verify parameters before proceeding
    verifyForceAtlas2Parameters(nodes, edges);
    // Merge custom settings with default settings
    const settings = { ...defaultSettings, ...customSettings };

    // Extract settings
    const {
        gravity,
        scalingRatio,
        edgeWeightInfluence,
        dissuadeHubs,
        preventOverlap,
        barnesHutTheta,
        repulsionStrength,
        coolingRate,
        width,
        height,
        nodeRadius
    } = settings;

    // Define the maximum velocity
    const maxVelocity = customSettings.maxVelocity || 1; // Use a default value if not specified

    // Define k based on width and height (example: k = Math.sqrt((width * height) / nodes.length))
    const k = Math.sqrt((width * height) / nodes.length);

    // Initialize the quadtree
    let quadTree = buildQuadTree(nodes, barnesHutTheta);

    // Cooling factor to reduce the movement over time
    let cooling = 1 - alpha;

    // Apply attraction forces once for all edges
    applyAttraction(nodes, edges, edgeWeightInfluence, k);

    // Apply gravity once for all nodes
    const center = { x: width / 2, y: height / 2 };
    applyGravity(nodes, gravity, scalingRatio, center);

    // Main loop to apply forces to each node
    for (let i = 0, n = nodes.length; i < n; ++i) {
        const node = nodes[i];

        // Log the node properties to confirm they are set correctly
        // nodes.forEach(node => {
        //     logger.log(`Node initialized: ${JSON.stringify(node)}`);
        // });

        // Apply repulsion forces (with Barnes-Hut optimization)
        const repulsion = quadTree.calculateRepulsion(node, barnesHutTheta, repulsionStrength);
        const degreeFactor = isNaN(node.degree) || node.degree === 0 ? 1 : node.degree;
        node.vx += repulsion.forceX * (dissuadeHubs ? degreeFactor : 1);
        node.vy += repulsion.forceY * (dissuadeHubs ? degreeFactor : 1);

        // Log the values after applying repulsion
        logger.log(`Values after repulsion for node ${node.id}:`, `x: ${node.x}, y: ${node.y}, vx: ${node.vx}, vy: ${node.vy}`);

        // Prevent overlapping (if enabled)
        if (preventOverlap) {
            applyPreventOverlap(nodes, nodeRadius); // Assuming nodeRadius is defined
        }

        // Update velocity and position based on forces
        updateVelocity(node, cooling, maxVelocity);
        updatePosition(node, width, height);


        // Log the values after updating velocity and position
        logger.log(`Values after update for node ${node.id}:`, `x: ${node.x}, y: ${node.y}, vx: ${node.vx}, vy: ${node.vy}`);
    }

    // Update the cooling factor dynamically for the next iteration
    cooling *= 1 - coolingRate;

    // Update the quadtree for the next iteration (Barnes-Hut optimization)
    quadTree = buildQuadTree(nodes, barnesHutTheta);
}



function calculateDegrees(nodes, links) {
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
    });
}

function applyAttraction(nodes, edges, edgeWeightInfluence, k) {
    for (const edge of edges) {

        const source = edge.source;
        const target = edge.target;
        const weight = edge.weight || 1;

        const xDistance = target.x - source.x;
        const yDistance = target.y - source.y;
        const distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance);

        // Calculate the attraction force with edge weight influence
        const attractionForce = (distance * distance) / (k * Math.pow(weight, edgeWeightInfluence));

        if (distance > 0) {
            source.vx += (xDistance / distance) * attractionForce;
            source.vy += (yDistance / distance) * attractionForce;
            target.vx -= (xDistance / distance) * attractionForce;
            target.vy -= (yDistance / distance) * attractionForce;
        }
    }
}

function applyGravity(nodes, gravity, scalingRatio, center) {
    for (const node of nodes) {
        // Use node.degree + 1 as mass if mass is not defined
        const mass = node.mass !== undefined ? node.mass : (node.degree + 1);

        const xDistance = center.x - node.x;
        const yDistance = center.y - node.y;
        const distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance);

        // Calculate the gravity force
        const gravityForce = gravity * mass * scalingRatio;

        if (distance > 0) {
            node.vx += (xDistance / distance) * gravityForce;
            node.vy += (yDistance / distance) * gravityForce;
        }
    }
}

function applyPreventOverlap(nodes, nodeRadius) {
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const nodeA = nodes[i];
            const nodeB = nodes[j];
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = nodeRadius(nodeA) + nodeRadius(nodeB); // Assuming nodeRadius is a function returning the radius

            if (distance < minDistance) {
                const overlap = minDistance - distance;
                const pushX = (dx / distance) * overlap / 2;
                const pushY = (dy / distance) * overlap / 2;

                nodeA.x -= pushX;
                nodeA.y -= pushY;
                nodeB.x += pushX;
                nodeB.y += pushY;
            }
        }
    }
}

function clipVelocity(node, maxVelocity) {
    const length = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (length > maxVelocity) {
        node.vx *= maxVelocity / length;
        node.vy *= maxVelocity / length;
    }
}

function updateVelocity(node, cooling, maxVelocity) {
    // Apply the cooling factor to the velocity
    node.vx *= cooling;
    node.vy *= cooling;
    clipVelocity(node, maxVelocity);
}

function updatePosition(node, width, height) {
    // Update the node's position based on its velocity
    node.x += node.vx;
    node.y += node.vy;

    // Keep the node within the bounds of the layout
    node.x = Math.min(width, Math.max(0, node.x));
    node.y = Math.min(height, Math.max(0, node.y));
}

export { forceAtlas2, defaultSettings, initializeGraphElements };
