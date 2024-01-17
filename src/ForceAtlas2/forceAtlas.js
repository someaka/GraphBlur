// eslint-disable-next-line no-unused-vars
import { forceAtlasLogger as logger } from '../logger.js';

// import { QuadTree, buildQuadTree, getDistance } from './quadTree.js';
import { QuadTree } from './quadTree2.js'; // Import QuadTree class

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

const defaultSettings = {
    gravity: 1,
    scalingRatio: 1.0,
    edgeWeightInfluence: 1,
    dissuadeHubs: true,
    preventOverlap: true,
    barnesHutTheta: 1.2,
    repulsionStrength: 5000,
    coolingRate: 0.1,
    width: DEFAULT_WIDTH,
    height: DEFAULT_WIDTH,
    nodeRadius: () => 5
};




function initializeSettings(customSettings, nodes) {
    const settings = { ...defaultSettings, ...customSettings };
    const maxVelocity = customSettings.maxVelocity || 1;
    const k = Math.sqrt((settings.width * settings.height) / nodes.length);
    const center = { x: settings.width / 2, y: settings.height / 2 };

    return { ...settings, maxVelocity, k, center };
}


function forceAtlas2(alpha, customSettings, nodes, edges) {
    const settings = initializeSettings(customSettings, nodes);
    let cooling = 1 - alpha;

    applyAttraction(edges, settings.edgeWeightInfluence, settings.k);
    applyGravity(nodes, settings.gravity, settings.scalingRatio, settings.center);

    applyForcesToNodes(nodes, settings, cooling);

    cooling *= 1 - settings.coolingRate;
}




function applyAttraction(edges, edgeWeightInfluence, k) {
    for (const edge of edges) {
        const source = edge.source;
        const target = edge.target;
        const weight = edge.weight || 1;

        const distance = getDistance(source, target);

        // Calculate the attraction force with edge weight influence
        const attractionForce = distance / k * Math.pow(weight, edgeWeightInfluence);
        // logger.log("attraction", attractionForce)

        const xDistance = target.x - source.x;
        const yDistance = target.y - source.y;

        source.vx += xDistance * attractionForce;
        source.vy += yDistance * attractionForce;
        target.vx -= xDistance * attractionForce;
        target.vy -= yDistance * attractionForce;
    }
}


function applyGravity(nodes, gravity, scalingRatio, center) {
    for (const node of nodes) {
        const mass = node.mass !== undefined ? node.mass : (node.degree + 1);

        const distance = getDistance(node, center);

        // Calculate the gravity force
        const gravityForce = gravity * mass * scalingRatio;

        if (distance > 0) {
            const xDistance = center.x - node.x;
            const yDistance = center.y - node.y;

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

            const distance = getDistance(nodeA, nodeB);
            const minDistance = nodeRadius(nodeA) + nodeRadius(nodeB);

            if (distance < minDistance) {
                const overlap = minDistance - distance;
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
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








import { calculateSimpleRepulsion } from './simpleRepulsion.js';


const simpleRepulsion = true;

function applyForcesToNodes(nodes, settings, cooling) {
    const { dissuadeHubs, preventOverlap, barnesHutTheta, repulsionStrength, maxVelocity, width, height, nodeRadius } = settings;
    const quadTree = new QuadTree(-width / 2, width / 2, -height / 2, height / 2);

    if (simpleRepulsion) {
        calculateSimpleRepulsion(nodes, repulsionStrength);
    } else {
        // Build a new quadtree for the current iteration
        nodes.forEach(node => quadTree.insert(node));
    }

    // Use the quadTree to calculate repulsion forces with Barnes-Hut optimization
    nodes.forEach(node => {
        if (simpleRepulsion) {
            const repulsion = quadTree.calculateRepulsion(node, barnesHutTheta * barnesHutTheta, repulsionStrength);
            node.vx += repulsion.forceX;
            node.vy += repulsion.forceY;
        }

        // Apply dissuadeHubs factor and update velocity and position
        const degreeFactor = isNaN(node.degree) || node.degree === 0 ? 1 : node.degree;
        node.vx *= (dissuadeHubs ? degreeFactor : 1);
        node.vy *= (dissuadeHubs ? degreeFactor : 1);

        updateVelocity(node, cooling, maxVelocity);
        updatePosition(node, width, height);
    });

    if (preventOverlap) {
        applyPreventOverlap(nodes, nodeRadius);
    }
}






// function applyForcesToNodes(nodes, settings, cooling) {
//     const { dissuadeHubs, preventOverlap, repulsionStrength, maxVelocity, width, height, nodeRadius } = settings;

//     calculateSimpleRepulsion(nodes, repulsionStrength);

//     nodes.forEach(node => {
//         const degreeFactor = isNaN(node.degree) || node.degree === 0 ? 1 : node.degree;
//         node.vx *= (dissuadeHubs ? degreeFactor : 1);
//         node.vy *= (dissuadeHubs ? degreeFactor : 1);

//         updateVelocity(node, cooling, maxVelocity);
//         updatePosition(node, width, height);
//     });

//     if (preventOverlap) {
//         applyPreventOverlap(nodes, nodeRadius);
//     }
// }



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



function getDistance(node, point) {
    const dx = node.x - point.x;
    const dy = node.y - point.y;
    return Math.hypot(dx, dy);
}

export {
    defaultSettings,
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    forceAtlas2
};
