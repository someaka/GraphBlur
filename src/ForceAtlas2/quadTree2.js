class QuadTree {
    constructor(xMin, xMax, yMin, yMax, capacity = 1) {
        this.bounds = { xMin, xMax, yMin, yMax };
        this.capacity = capacity;
        this.nodes = [];
        this.divided = false;
        this.mass = 0;
        this.massCenter = { x: 0, y: 0 };
    }


    subdivide() {
        const { xMin, xMax, yMin, yMax } = this.bounds;
        const xMid = (xMin + xMax) / 2;
        const yMid = (yMin + yMax) / 2;

        this.northeast = new QuadTree(xMid, xMax, yMin, yMid, this.capacity);
        this.northwest = new QuadTree(xMin, xMid, yMin, yMid, this.capacity);
        this.southeast = new QuadTree(xMid, xMax, yMid, yMax, this.capacity);
        this.southwest = new QuadTree(xMin, xMid, yMid, yMax, this.capacity);

        this.divided = true;
    }

    insert(node) {
        if (this.nodes.length < this.capacity && !this.divided) {
            this.nodes.push(node);
            this.updateMassAndCenter(node);
            return true;
        }

        if (!this.divided) {
            this.subdivide();
        }

        // Determine which quadrant the node belongs to and insert it there
        const xMid = (this.bounds.xMin + this.bounds.xMax) / 2;
        const yMid = (this.bounds.yMin + this.bounds.yMax) / 2;
        const isWest = node.x < xMid;
        const isNorth = node.y < yMid;

        if (isWest) {
            return isNorth ? this.northwest.insert(node) : this.southwest.insert(node);
        } else {
            return isNorth ? this.northeast.insert(node) : this.southeast.insert(node);
        }
    }


    updateMassAndCenter(node) {
        const totalMass = this.mass + node.mass;
        this.massCenter.x = (this.massCenter.x * this.mass + node.x * node.mass) / totalMass;
        this.massCenter.y = (this.massCenter.y * this.mass + node.y * node.mass) / totalMass;
        this.mass = totalMass;
    }

    // Method to calculate repulsion forces

    calculateRepulsion(node, thetaSquared, repulsionStrength) {
        // If there is no division, calculate direct repulsion from individual nodes
        if (!this.divided) {
            let forceX = 0, forceY = 0;
            for (let other of this.nodes) {
                if (node !== other) {
                    const [force, distance] = this.calculateForceAndDistance(node, other, repulsionStrength);
                    if (distance > 0) { // Avoid division by zero
                        forceX += (other.x - node.x) / distance * force;
                        forceY += (other.y - node.y) / distance * force;
                    }
                }
            }
            return { forceX, forceY };
        }

        // Calculate the distance from the node to the region's mass center
        const distance = Math.sqrt(
            (node.x - this.massCenter.x) ** 2 +
            (node.y - this.massCenter.y) ** 2
        );

        // If the region is sufficiently far away, approximate the repulsive force
        if ((this.bounds.xMax - this.bounds.xMin) / distance < Math.sqrt(thetaSquared)) {
            const [force] = this.calculateForceAndDistance(node, this.massCenter, repulsionStrength, this.mass);
            return {
                forceX: (this.massCenter.x - node.x) / distance * force,
                forceY: (this.massCenter.y - node.y) / distance * force
            };
        }

        // Otherwise, aggregate forces from child quadrants
        let forceX = 0, forceY = 0;
        const quadrants = [this.northeast, this.northwest, this.southeast, this.southwest];
        for (const quadrant of quadrants) {
            const { forceX: qx, forceY: qy } = quadrant.calculateRepulsion(node, thetaSquared, repulsionStrength);
            forceX += qx;
            forceY += qy;
        }

        return { forceX, forceY };
    }


    calculateForceAndDistance(node1, node2, strength, mass = node2.mass) {
        const dx = node1.x - node2.x;
        const dy = node1.y - node2.y;
        const distanceSquared = dx * dx + dy * dy;
        const distance = Math.sqrt(distanceSquared);
        
        const force = strength * mass / distanceSquared;
        // const force = Math.pow(strength, 5 ) * mass / distanceSquared;

        return [force, distance];
    }
}


export { QuadTree };