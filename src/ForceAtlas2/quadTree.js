import { quadTreeLogger as logger } from '../logger.js';


class QuadTree {
  constructor(xMin, xMax, yMin, yMax, capacity = 1) {
    this.bounds = { xMin, xMax, yMin, yMax };
    this.capacity = capacity;
    this.nodes = [];
    this.divided = false;
  }

  subdivide() {
    const xMid = (this.bounds.xMin + this.bounds.xMax) / 2;
    const yMid = (this.bounds.yMin + this.bounds.yMax) / 2;

    this.northeast = new QuadTree(xMid, this.bounds.xMax, this.bounds.yMin, yMid, this.capacity);
    this.northwest = new QuadTree(this.bounds.xMin, xMid, this.bounds.yMin, yMid, this.capacity);
    this.southeast = new QuadTree(xMid, this.bounds.xMax, yMid, this.bounds.yMax, this.capacity);
    this.southwest = new QuadTree(this.bounds.xMin, xMid, yMid, this.bounds.yMax, this.capacity);

    this.divided = true;
  }

  insert(node) {
    if (!this.contains(node)) {
      return false;
    }

    if (this.nodes.length < this.capacity) {
      this.nodes.push(node);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    return (this.northeast.insert(node) || this.northwest.insert(node) ||
      this.southeast.insert(node) || this.southwest.insert(node));
  }

  contains(node) {
    return (node.x >= this.bounds.xMin && node.x <= this.bounds.xMax &&
      node.y >= this.bounds.yMin && node.y <= this.bounds.yMax);
  }

  calculateRepulsion(node, theta, repulsionStrength) {
    logger.log("Calculating repulsion for node:", node.id, "with theta:", theta, "and repulsionStrength:", repulsionStrength);
    let forceX = 0;
    let forceY = 0;

    if (this.nodes.length === 1 && this.nodes[0] !== node) {
      // Single external node in this quadrant, calculate direct repulsion
      const other = this.nodes[0];
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Log intermediate values
      logger.log(`dx: ${dx}, dy: ${dy}, distance: ${distance}`);

      if (distance > 0) {
        const repulsionForce = repulsionStrength / (distance * distance);
        forceX += (dx / distance) * repulsionForce;
        forceY += (dy / distance) * repulsionForce;
        logger.log("Repulsion force applied to node:", node.id, "with forceX:", forceX, "and forceY:", forceY);
      } else {
        // Handle zero distance case
        logger.log(`Distance is zero, skipping repulsion calculation for node ${node.id}`, `with dx: ${dx}, dy: ${dy}, distance: ${distance}`, `and forceX: ${forceX}, forceY: ${forceY}`);
        return { forceX, forceY };
      }
    } else if (this.divided || this.nodes.length > 1) {
      // Check if we can approximate the nodes in this quadrant as a single point mass
      const s = this.bounds.xMax - this.bounds.xMin; // Size of the quadrant
      const d = Math.sqrt(Math.pow(node.x - (this.bounds.xMin + s / 2), 2) +
        Math.pow(node.y - (this.bounds.yMin + s / 2), 2));

      if (s / d < theta) {
        // Treat this quadrant as a single point mass
        const totalMass = this.nodes.length;
        const massCenterX = (this.bounds.xMin + this.bounds.xMax) / 2;
        const massCenterY = (this.bounds.yMin + this.bounds.yMax) / 2;
        const dx = node.x - massCenterX;
        const dy = node.y - massCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
          const repulsionForce = (repulsionStrength * totalMass) / (distance * distance);
          forceX += (dx / distance) * repulsionForce;
          forceY += (dy / distance) * repulsionForce;
        } else {
          // Handle zero distance case
          logger.log(`Distance is zero, skipping repulsion calculation for node ${node.id}`);
          return { forceX, forceY };
        }

        // Log the calculated forces
        logger.log(`forceX: ${forceX}, forceY: ${forceY}`);
      } else {
        // Recursively calculate repulsion from the child quadrants
        if (this.northeast) {
          const repulsionResult = this.northeast.calculateRepulsion(node, theta, repulsionStrength);
          if (repulsionResult && !isNaN(repulsionResult.forceX) && !isNaN(repulsionResult.forceY)) {
            forceX += repulsionResult.forceX;
            forceY += repulsionResult.forceY;
          } else {
            logger.error('Northeast quadrant returned an invalid repulsion result:', repulsionResult);
          }
        }
        if (this.northwest) {
          const repulsionResult = this.northwest.calculateRepulsion(node, theta, repulsionStrength);
          if (repulsionResult && !isNaN(repulsionResult.forceX) && !isNaN(repulsionResult.forceY)) {
            forceX += repulsionResult.forceX;
            forceY += repulsionResult.forceY;
          } else {
            logger.error('Northwest quadrant returned an invalid repulsion result:', repulsionResult);
          }
        }
        if (this.southeast) {
          const repulsionResult = this.southeast.calculateRepulsion(node, theta, repulsionStrength);
          if (repulsionResult && !isNaN(repulsionResult.forceX) && !isNaN(repulsionResult.forceY)) {
            forceX += repulsionResult.forceX;
            forceY += repulsionResult.forceY;
          } else {
            logger.error('Southeast quadrant returned an invalid repulsion result:', repulsionResult);
          }
        }
        if (this.southwest) {
          const repulsionResult = this.southwest.calculateRepulsion(node, theta, repulsionStrength);
          if (repulsionResult && !isNaN(repulsionResult.forceX) && !isNaN(repulsionResult.forceY)) {
            forceX += repulsionResult.forceX;
            forceY += repulsionResult.forceY;
          } else {
            logger.error('Southwest quadrant returned an invalid repulsion result:', repulsionResult);
          }
        }
        logger.log("second else bit:", node.id, "with forceX:", forceX, "and forceY:", forceY);
      }
    }

    // Log the repulsion forces before returning
    if (isNaN(forceX) || isNaN(forceY)) {
      logger.error(`Calculated NaN repulsion for node ${node.id}:`, { forceX, forceY, node, theta, repulsionStrength });
    }
    return { forceX, forceY };
  }
}

function buildQuadTree(nodes, barnesHutTheta) {
  // Determine the bounds of the quadtree
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const node of nodes) {
    if (node.x < xMin) xMin = node.x;
    if (node.x > xMax) xMax = node.x;
    if (node.y < yMin) yMin = node.y;
    if (node.y > yMax) yMax = node.y;
  }

  // Create the root of the quadtree
  const root = new QuadTree(xMin, xMax, yMin, yMax);

  // Insert all nodes into the quadtree
  for (const node of nodes) {
    root.insert(node);
  }

  return root;
}

export { QuadTree, buildQuadTree };
