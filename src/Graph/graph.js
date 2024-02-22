import { graphLogger as logger } from '../logger.js';
import { articlesCache } from "../Feeds/data/FeedCache.js";
import { visualizeGraph, clearGraph } from "./graphologySigma.js";
import { createPairKey, reversePairKey } from '../utils/graphHelpers.js';
import { getColorFromString } from '../utils/colorUtils.js';

import chroma from "chroma-js";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

class Graph {
    /**
     * @type {Graph | null}
     */
    static instance = null;
    static getInstance() {
        if (!this.instance) {
            this.instance = new Graph();
        }
        return this.instance;
    }

    constructor() {
        this.similarityPairs = new Map();
        this.existingEdgesSet = new Set();
        this.negativeEdges = false;
        this.dimensions = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    }


    setNegativeEdges(value) {
        this.negativeEdges = value;
        logger.log('Negative edges set to:', this.negativeEdges);
        this.updateGraphForSelectedFeeds();
    }



    articlesToNodes(articles) {
        const center = { x: 0, y: 0 }; // Adjust this if your graph's center is different
        const radius = 0.11; // Small radius around the center for initial node placement


        // COOLEST LOOKING BUG EVER
        // just to be clear the random should be done inside the map
        // but this makes it look awesome

        
        // Randomize position around the center within the defined radius
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;

        return articles.map((/** @type {{ id: any; title: any; feedColor: any; }} */ article) => ({
            id: article.id,
            title: article.title,
            color: getColorFromString(article.feedColor),
            // night_color: getColorFromString(article.feedColor), // no change for now
            x: center.x + distance * Math.cos(angle),
            y: center.y + distance * Math.sin(angle),
            vx: 0,
            vy: 0,
            degree: 0,
            mass: 0
        }));
    }

    articlesToLinks(nodes) {
        const links = [];
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const mix = chroma.mix(nodes[i].color, nodes[j].color, 0.5, 'rgb');
                const day = mix.brighten(0.77).hex();
                const night = mix.darken(0.77).hex();
                links.push({
                    source: nodes[i],
                    target: nodes[j],
                    weight: this.getSimilarity(nodes[i].id, nodes[j].id),
                    color: day,
                    day_color: day,
                    night_color: night
                });
            }
        }
        return links;
    }

    getSimilarity(id1, id2) {
        const pairKey = createPairKey(id1, id2);
        const reveKey = reversePairKey(pairKey);
        const res = this.similarityPairs.get(pairKey) || this.similarityPairs.get(reveKey) || -2;
        return res;
    }

    validateDimensions({ width, height }) {
        return {
            width: this.isValidNumber(width) ? width : DEFAULT_WIDTH,
            height: this.isValidNumber(height) ? height : DEFAULT_HEIGHT
        };
    }

    isValidNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    }

    filterEdgesByPercentile(edges, percentile = 0.2) {
        // Calculate the threshold weight based on the percentile
        const weights = edges.map((/** @type {{ weight: any; }} */ edge) => this.normalizeEdgeWeight(edge.weight));
        const sortedWeights = Array.from(weights).sort((/** @type {number} */ a, /** @type {number} */ b) => a - b);
        const postitiveWeights = sortedWeights.filter((/** @type {number} */ weight) => weight >= 0);
        const index = Math.floor(percentile * postitiveWeights.length);
        const threshold = postitiveWeights[index];

        return edges.filter((/** @type {{ weight: number; }} */ edge) => this.normalizeEdgeWeight(edge.weight) >= threshold);

    }

    normalizeEdgeWeight(edgeWeight) {
        // Normalize edge weights from [-1, 1] to [0, 1]
        return (edgeWeight + 1) / 2;
    }






    /**
     * @param {Map<string, number> | null} newSimilarityPairs
     */
    async updateGraphForSelectedFeeds(newSimilarityPairs = null, emptyArticles = false) {
        // Update the existingEdgesSet
        if (newSimilarityPairs) {
            for (let [edge, score] of newSimilarityPairs.entries()) {
                //const {edge, score} = pair;
                if (!this.existingEdgesSet.has(edge) && !this.existingEdgesSet.has(reversePairKey(edge))) {
                    this.existingEdgesSet.add(edge);
                    this.existingEdgesSet.add(reversePairKey(edge));
                    this.similarityPairs.set(edge, score);
                    this.similarityPairs.set(reversePairKey(edge), score);
                }

            }
        }


        let nodes = [];
        let links = [];

        const selectedFeedsElements = document.querySelectorAll('#feedslist div.clicked');

        // Create a map of selected feed IDs for quick lookup
        const selectedFeedIds = new Set();
        selectedFeedsElements.forEach(feedElement => {
            const { id: feedId } = feedElement;
            selectedFeedIds.add(feedId);
        });

        selectedFeedsElements.forEach(feedElement => {
            const { id: feedId } = feedElement;
            let feedArticles = articlesCache[feedId];
        
            if (feedArticles) {
                // Filter out articles with empty strings if emptyArticles is false
                if (!emptyArticles) {
                    feedArticles = feedArticles.filter(article => article.id && article.article?.title && article.article?.text);
                }
        
                const newNodes = this.articlesToNodes(
                    feedArticles.map((article) => ({
                        id: article.id || '',
                        title: article.article?.title || '',
                        feedColor: article.feedColor || '',
                        content: article.article?.text || ''
                    }))
                );
        
                nodes = nodes.concat(newNodes);
            }
        });


        if (nodes.length > 0) {
            links = this.articlesToLinks(nodes);
            links = this.negativeEdges ? links : this.filterEdgesByPercentile(links, 0.5);
            visualizeGraph({ nodes, links });
        } else {
            clearGraph();
        }
    }



}



/**
 * @param {Map<string, number> | null} newSimilarityPairs
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
