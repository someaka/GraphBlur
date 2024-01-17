class QuadTree {
  constructor(xMin, xMax, yMin, yMax, capacity = 1) {
    this.bounds = { xMin, xMax, yMin, yMax };
    this.capacity = capacity;
    this.nodes = [];
    this.divided = false;
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

    return (
      this.northeast.insert(node) ||
      this.northwest.insert(node) ||
      this.southeast.insert(node) ||
      this.southwest.insert(node)
    );
  }

  contains(node) {
    const { xMin, xMax, yMin, yMax } = this.bounds;
    return node.x >= xMin && node.x <= xMax && node.y >= yMin && node.y <= yMax;
  }


  calculateRepulsion(node, theta, repulsionStrength) {
    const strategies = [
      this.calculateSingleExternalNodeRepulsion.bind(this, node, repulsionStrength),
      this.calculatePointMassRepulsion.bind(this, node, theta, repulsionStrength),
      this.calculateChildrenRepulsion.bind(this, node, theta, repulsionStrength)
    ];

    for (const strategy of strategies) {
      const force = strategy();
      if (force) return force;
    }

    return { forceX: 0, forceY: 0 };
  }

  calculateSingleExternalNodeRepulsion(node, repulsionStrength) {
    if (this.nodes.length === 1 && this.nodes[0] !== node) {
      return this.calculateDirectRepulsion(node, this.nodes[0], repulsionStrength);
    }
    return null;
  }

  calculatePointMassRepulsion(node, theta, repulsionStrength) {
    const d = getDistance(node, this.getMassCenter());
    if (this.nodes.length > 1 && (this.bounds.xMax - this.bounds.xMin) / d < theta) {
      return this.calculateMassRepulsion(node, this.getMassCenter(), this.nodes.length, repulsionStrength);
    }
    return null;
  }

  calculateChildrenRepulsion(node, theta, repulsionStrength) {
    if (this.divided) {
      return this.getRepulsionFromChildren(node, theta, repulsionStrength);
    }
    return null;
  }

  getMassCenter() {
    const { xMin, xMax, yMin, yMax } = this.bounds;
    return {
      x: (xMin + xMax) / 2,
      y: (yMin + yMax) / 2
    };
  }




  calculateRepulsionForce(dx, dy, distance, strength) {
    if (distance === 0) {
      return { forceX: 0, forceY: 0 };
    }
    const repulsionForce = strength / (distance * distance);
    return {
      forceX: (dx / distance) * repulsionForce,
      forceY: (dy / distance) * repulsionForce
    };
  }

  calculateDirectRepulsion(node, other, repulsionStrength) {
    const dx = node.x - other.x;
    const dy = node.y - other.y;
    const distance = getDistance(node, other);
    return this.calculateRepulsionForce(dx, dy, distance, repulsionStrength);
  }

  calculateMassRepulsion(node, massCenter, totalMass, repulsionStrength) {
    const dx = node.x - massCenter.x;
    const dy = node.y - massCenter.y;
    const distance = getDistance(node, massCenter);
    return this.calculateRepulsionForce(dx, dy, distance, repulsionStrength * totalMass);
  }


  getRepulsionFromChildren(node, theta, repulsionStrength) {
    let forceX = 0;
    let forceY = 0;
    if (this.divided) {
      forceX += this.northeast.calculateRepulsion(node, theta, repulsionStrength).forceX;
      forceY += this.northeast.calculateRepulsion(node, theta, repulsionStrength).forceY;

      forceX += this.northwest.calculateRepulsion(node, theta, repulsionStrength).forceX;
      forceY += this.northwest.calculateRepulsion(node, theta, repulsionStrength).forceY;

      forceX += this.southeast.calculateRepulsion(node, theta, repulsionStrength).forceX;
      forceY += this.southeast.calculateRepulsion(node, theta, repulsionStrength).forceY;

      forceX += this.southwest.calculateRepulsion(node, theta, repulsionStrength).forceX;
      forceY += this.southwest.calculateRepulsion(node, theta, repulsionStrength).forceY;
    }
    return { forceX, forceY };
  }
}

function getDistance(node, point) {
  const dx = node.x - point.x;
  const dy = node.y - point.y;
  return Math.hypot(dx, dy);
}

function buildQuadTree(nodes) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const node of nodes) {
    xMin = Math.min(xMin, node.x);
    xMax = Math.max(xMax, node.x);
    yMin = Math.min(yMin, node.y);
    yMax = Math.max(yMax, node.y);
  }

  const root = new QuadTree(xMin, xMax, yMin, yMax);
  nodes.forEach(node => root.insert(node));
  return root;
}

export { QuadTree, buildQuadTree, getDistance };