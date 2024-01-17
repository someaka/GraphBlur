// simpleRepulsion.js

function calculateSimpleRepulsion(nodes, repulsionStrength) {
    nodes.forEach((nodeA, indexA) => {
        let forceX = 0;
        let forceY = 0;

        nodes.forEach((nodeB, indexB) => {
            if (indexA === indexB) return; // Skip self

            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const distanceSquared = distance * distance || 1; // Avoid division by zero

            // Repulsion force is inversely proportional to distance squared
            const forceMagnitude = repulsionStrength / distanceSquared;

            // Accumulate forces
            forceX += (dx / distance) * forceMagnitude;
            forceY += (dy / distance) * forceMagnitude;
        });

        // Update velocities based on accumulated force
        nodeA.vx += forceX;
        nodeA.vy += forceY;
    });
}

export { calculateSimpleRepulsion };