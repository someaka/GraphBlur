import { graphLogger as logger } from '../logger.js';
import { articlesCache } from "../Feeds/data/FeedCache.js";
import { visualizeGraph, clearGraph } from "./graphologySigma.js";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

class Graph {
    /**
     * @type {Graph | null}
     */
    static instance = null;
    similarityPairs = {};
    negativeEdges = false;
    lastNormalizeValue = false;
    dimensions = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    // Specify the graph types data for nodes and links
    /**
     * @type {{ nodes: any[]; links: any[]; }}
     */
    graphData = { nodes: [], links: [] };

    static getInstance() {
        if (!this.instance) {
            this.instance = new Graph();
        }
        return this.instance;
    }



    /**
     * @param {{ id: any; title: any; feedColor: any; content: any; }[]} articles
     */
    updateNodes(articles, dimensions = this.dimensions) {
        const newNodes = this.articlesToNodes(articles, dimensions);
        newNodes.forEach((/** @type {{ id: any; }} */ newNode) => {
            if (!this.graphData.nodes.find(node => node.id === newNode.id)) {
                this.graphData.nodes.push(newNode);
            }
        });
    }

    /**
     * @param {{ id: any; title: any; feedColor: any; content: any; }[]} selectedArticles
     */
    updateLinks(selectedArticles) {
        const newLinks = this.articlesToLinks(selectedArticles);
        newLinks.forEach(newLink => {
            if (!this.graphData.links.find(link => link.source.id === newLink.source.id && link.target.id === newLink.target.id)) {
                this.graphData.links.push(newLink);
            }
        });
    }

    // Setter function for negativeEdges
    /**
     * @param {boolean} value
     */
    setNegativeEdges(value) {
        this.negativeEdges = value;
        logger.log('Negative edges set to:', this.negativeEdges);
        this.updateGraphForSelectedFeeds();
    }

    /**
     * @param {any} articles
     */
    constructGraphData(articles, dimensions = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }) {
        const nodes = this.articlesToNodes(articles, dimensions);
        const links = this.articlesToLinks(nodes);
        return { nodes, links };
    }

    /**
     * @param {any[]} articles
     * @param {{ width: any; height: any; }} dimensions
     */
    articlesToNodes(articles, dimensions) {
        const { width, height } = this.validateDimensions(dimensions);
        return articles.map((/** @type {{ id: any; title: any; feedColor: any; }} */ article) => ({
            id: article.id,
            title: article.title,
            color: article.feedColor,
            x: width / 2 + (Math.random() - 0.5) * 10,
            y: height / 2 + (Math.random() - 0.5) * 10,
            vx: 0,
            vy: 0,
            degree: 0,
            mass: 0,
            selected: false // Add this line
        }));
    }

    /**
     * @param {string | any[]} nodes
     */
    articlesToLinks(nodes) {
        const links = [];
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                links.push({
                    source: nodes[i],
                    target: nodes[j],
                    weight: 0,
                    selected: false // Add this line
                });
            }
        }
        return links;
    }

    validateDimensions({ width, height }) {
        return {
            width: this.isValidNumber(width) ? width : DEFAULT_WIDTH,
            height: this.isValidNumber(height) ? height : DEFAULT_HEIGHT
        };
    }

    /**
     * @param {number} value
     */
    isValidNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    }

    // Function to filter out edges below a certain percentile
    /**
     * @param {any[]} edges
     */
    filterEdgesByPercentile(edges, percentile = 0.2) {
        // Calculate the threshold weight based on the percentile
        const weights = edges.map((/** @type {{ weight: any; }} */ edge) => edge.weight).sort((/** @type {number} */ a, /** @type {number} */ b) => a - b);
        const index = Math.floor(percentile * weights.length);
        const threshold = weights[index];

        // Filter out edges below the threshold
        return edges.filter((/** @type {{ weight: number; }} */ edge) => edge.weight >= threshold);
    }


    /**
     * 
     * @param {{} | null} newSimilarityPairs 
     */
    async updateGraphForSelectedFeeds(newSimilarityPairs = null) {
        this.similarityPairs = newSimilarityPairs || this.similarityPairs;

        const selectedFeedsElements = document.querySelectorAll('#feedslist div.clicked');

        // Create a map of selected feed IDs for quick lookup
        const selectedFeedIds = new Set();
        selectedFeedsElements.forEach(feedElement => {
            const { id: feedId } = feedElement;
            selectedFeedIds.add(feedId);
        });

        // Filter out unselected nodes and links
        /**
         * @type {any[]}
         */
        const selectedNodes = this.graphData.nodes.filter(node => selectedFeedIds.has(node.feedId));
        /**
         * @type {any[]}
         */
        const selectedLinks = this.graphData.links.filter(link => selectedFeedIds.has(link.source.feedId) && selectedFeedIds.has(link.target.feedId));

        // Update the graph data with the selected nodes and links
        this.graphData.nodes = selectedNodes;
        this.graphData.links = selectedLinks;

        selectedFeedsElements.forEach(feedElement => {
            const { id: feedId } = feedElement;
            const feedArticles = articlesCache[feedId];

            if (feedArticles) {
                feedArticles.forEach((/** @type {{ id: any; article: { title: any; text: any; }; feedColor: any; }} */ article) => {
                    const articleWithFallbacks = {
                        id: article.id || '',
                        title: article.article?.title || '',
                        feedColor: article.feedColor || '',
                        content: article.article?.text || ''
                    };
                    this.updateNodes([articleWithFallbacks]);
                    //if (newSimilarityPairs) {
                    this.updateLinks([articleWithFallbacks]);
                    // }
                });
            }
        });

        if (this.graphData.nodes.length > 0) {
            //if (newSimilarityPairs) {
            this.checkAndLogSimilarityPairs(this.graphData);
            // }
            visualizeGraph(this.graphData);
        } else {
            clearGraph();
        }
    }



    /**
     * @param {{ nodes: any[]; links: any[]; }} graphData
     */
    checkAndLogSimilarityPairs(graphData) {
        // If a similarity Pairs is provided, update the weights of the edges
        if (this.similarityPairs) {
            logger.log("negative edges: ", this.negativeEdges);

            // Extract weights from graphData.links before update and log them
            const weightsBeforeUpdate = graphData.links.map((/** @type {{ source: { id: any; }; target: { id: any; }; weight: any; }} */ link) => ({ source: link.source.id, target: link.target.id, weight: link.weight }));
            logger.log('Graph data before similarity Pairs update:');
            logger.table(weightsBeforeUpdate);

            this.updateGraphEdgesWithSimilarityPairs(graphData, this.similarityPairs, !this.negativeEdges);
            graphData.links = this.negativeEdges ? graphData.links : this.filterEdgesByPercentile(graphData.links, 0.5);

            // Extract weights from graphData.links after update and log them
            const weightsAfterUpdate = graphData.links.map((/** @type {{ source: { id: any; }; target: { id: any; }; weight: any; }} */ link) => ({ source: link.source.id, target: link.target.id, weight: link.weight }));
            logger.log('Graph data after similarity Pairs update:');
            logger.table(weightsAfterUpdate);
        }
    }

    /**
     * @param {number} edgeWeight
     */
    normalizeEdgeWeight(edgeWeight) {
        // Normalize edge weights from [-1, 1] to [0, 1]
        return (edgeWeight + 1) / 2;
    }

    /**
     * @param {any} graphData
     * @param {{}} similarityPairs
     */
    updateGraphEdgesWithSimilarityPairs(graphData, similarityPairs, normalize = true) {
        if (normalize !== this.lastNormalizeValue) {
            this.updateAllEdgesWeights(graphData, similarityPairs, normalize);
            this.lastNormalizeValue = normalize;
        } else {
            this.addNewEdgesFromSimilarityPairs(graphData, similarityPairs, normalize);
        }
    }

    /**
     * @param {{ links: { source: string; target: string; weight: any; }[]; }} graphData
     * @param {{ [s: string]: any; } | ArrayLike<any>} similarityPairs
     * @param {boolean} normalize
     */
    updateAllEdgesWeights(graphData, similarityPairs, normalize) {
        // Clear all existing links
        graphData.links = [];

        // Iterate over the similarityPairs object
        Object.entries(similarityPairs).forEach(([key, similarityScore]) => {
            // Split the key into source and target IDs
            const [sourceId, targetId] = key.split('_');

            // Create a new link
            const newLink = {
                source: sourceId,
                target: targetId,
                weight: normalize ? this.normalizeEdgeWeight(similarityScore) : similarityScore
            };

            // Add the new link to the graphData
            graphData.links.push(newLink);
        });
    }

    /**
     * @param {{ links: { map: (arg0: (link: any) => any[]) => Iterable<readonly [any, any]> | null | undefined; push: (arg0: { source: string; target: string; weight: any; }) => void; }; }} graphData
     * @param {{ [s: string]: any; } | ArrayLike<any>} similarityPairs
     * @param {boolean} normalize
     */
    addNewEdgesFromSimilarityPairs(graphData, similarityPairs, normalize) {
        const existingEdgesMap = new Map(graphData.links.map((/** @type {{ source: { id: any; }; target: { id: any; }; }} */ link) => [`${link.source.id}_${link.target.id}`, link]));

        Object.entries(similarityPairs).forEach(([key, similarityScore]) => {
            if (!existingEdgesMap.has(key)) {
                const [sourceId, targetId] = key.split('_');
                const newEdge = {
                    source: sourceId,
                    target: targetId,
                    weight: normalize ? this.normalizeEdgeWeight(similarityScore) : similarityScore
                };

                graphData.links.push(newEdge);
            }
        });
    }


}



/**
 * @param {any | null} newSimilarityPairs
 */
const updateGraphForSelectedFeeds = (newSimilarityPairs = null) =>
    Graph.getInstance().updateGraphForSelectedFeeds(newSimilarityPairs);

/**
 * @param {boolean} value
 */
const setNegativeEdges = (value) => Graph.getInstance().setNegativeEdges(value);
/**
 * @type {boolean}
 */
const negativeEdges = Graph.getInstance().negativeEdges;

export {
    updateGraphForSelectedFeeds,
    setNegativeEdges,
    negativeEdges
}
