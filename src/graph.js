import * as d3 from 'd3';

export async function calculateSimilarity(articles) {
    const response = await fetch('/calculate-similarity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(articles)
    });
    const similarityMatrix = await response.json();
    console.log('Updated similarity matrix:', similarityMatrix);
}

export function visualizeGraph(graphData) {
    const width = 800; // Set the width of the graph
    const height = 600; // Set the height of the graph

    // Select the SVG element, creating it if it doesn't exist
    let svg = d3.select('#graphcontent').select('svg');
    if (svg.empty()) {
        console.log("Creating new SVG");
        svg = d3.select('#graphcontent').append('svg')
            .attr('width', width)
            .attr('height', height);
    } else {
        console.log("SVG already exists");
    }

    // Bind the new data to the nodes
    const nodes = svg.selectAll('circle')
        .data(graphData.nodes, d => d.id);

    console.log("Nodes data:", graphData.nodes);

    // Enter new nodes
    const enteredNodes = nodes.enter().append('circle')
        .attr('r', 5)
        .attr('fill', d => d.color);

    console.log("Entered nodes:", enteredNodes.nodes());

    enteredNodes.merge(nodes) // Merge enter and update selections
        .call(d3.drag() // Re-apply drag behavior to new and updated nodes
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded));

    // Remove old nodes
    nodes.exit().remove();

    // Define and start the simulation if it's not already running
    if (!window.simulation) {
        console.log("Creating new simulation");
        window.simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links).id(d => d.id))
            .force('charge', d3.forceManyBody())
            .force('center', d3.forceCenter(width / 2, height / 2))
            .on('tick', ticked);
    } else {
        console.log("Updating simulation");
        window.simulation.nodes(graphData.nodes);
        window.simulation.force('link').links(graphData.links);
        window.simulation.alpha(0.3).restart();
    }

    function ticked() {
        // Update node positions
        svg.selectAll('circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    }
}


function dragStarted(event, d) {
    if (!event.active) window.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d) {
    if (!event.active) window.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

export function constructGraphData(articles) {
    // Create nodes for each article
    const nodes = articles.map(article => ({
        id: article.id,
        title: article.title,
        color: article.feedColor
    }));

    // Create links with equal weights between all pairs of nodes
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            links.push({
                source: nodes[i],
                target: nodes[j],
                weight: 1 // Equal weight for all edges
            });
        }
    }
    // articles.forEach((article, i) => {
    //     // Loop over all articles
    //     articles.forEach((otherArticle, j) => {
    //         // Skip if the articles are the same
    //         if (i === j) return;

    //         // Calculate similarity score
    //         const similarityScore = calculateSimilarity(article.embedding, otherArticle.embedding);

    //         // Only add a link if there is some similarity
    //         if (similarityScore > 0) {
    //             links.push({
    //                 source: nodes[i],
    //                 target: nodes[j],
    //                 value: similarityScore
    //             });
    //         }
    //     });
    // });

    console.log('Nodes after mapping:', nodes); // Log the nodes after they are created


    return { nodes, links };
}

export function clearGraph() {
    // Stop the simulation if it's running
    if (window.simulation) {
        window.simulation.stop();
        window.simulation = null; // Clear the reference to the simulation
    }

    // Clear the contents of the SVG element without removing it
    d3.select('#graphcontent').select('svg').selectAll('*').remove();
}

export async function updateGraphForSelectedFeeds(articlesCache) {
    console.log('Articles cache:', articlesCache); // Log the entire articlesCache

    const selectedFeedsElements = document.querySelectorAll('#feedslist div.clicked');
    console.log('selected Feeds Elements:', selectedFeedsElements); // Log the entire articlesCache

    let allArticles = [];

    selectedFeedsElements.forEach(feedElement => {
        console.log(`Feed element ID: ${feedElement.id}`); // Log the id of the feed element
        const feedId = feedElement.id; // Use the id property to get the feed ID
        console.log(`Collecting articles for feedId: ${feedId}`); // Log the current feedId being processed
        if (articlesCache[feedId]) {
            allArticles = allArticles.concat(articlesCache[feedId]);
        }
    });

    if (allArticles.length > 0) {
        const graphData = constructGraphData(allArticles);
        visualizeGraph(graphData);
    } else {
        clearGraph(); // Clear the graph if no feeds are selected
    }
}