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

export function visualizeGraph(graph) {
    const width = 800; // Width of the graph
    const height = 600; // Height of the graph

    // Remove any existing SVG to start fresh when visualizing a new graph
    d3.select('#graphcontent').select('svg').remove();

    // Create the SVG element
    const svg = d3.select('#graphcontent').append('svg')
        .attr('width', width)
        .attr('height', height);

    // Create the simulation with forces
    const simulation = d3.forceSimulation(graph.nodes)
        .force('link', d3.forceLink(graph.links).id(d => d.id).distance(50))
        .force('charge', d3.forceManyBody().strength(-50))
        .force('center', d3.forceCenter(width / 2, height / 2));

    // Create the links (lines)
    const link = svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(graph.links)
        .enter().append('line')
        .attr('stroke-width', d => Math.sqrt(d.value));

    // Create the nodes (circles)
    const node = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(graph.nodes)
        .enter().append('circle')
        .attr('r', 5)
        .attr('fill', d => {
            // Log the color being used for each node
            console.log(`Node ${d.id} color:`, d.color);
            return d.color;
        })
        .call(d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded));

    // Add titles to nodes (hover tooltip)
    node.append('title')
        .text(d => d.title);

    // Define the tick function for the simulation
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });

    // Drag functions
    function dragStarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragEnded(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }
}

export function constructGraphData(articles) {
    console.log('Articles before mapping:', articles); // Log the articles before mapping

    // Create nodes for each article
    const nodes = articles.map((article, index) => ({
        id: article.id, // Make sure each article has a unique ID
        title: article.title,
        color: article.feedColor // Use the color associated with the feed
    }));
    const links = [];

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
    d3.select('#graphcontent').select('svg').remove(); // Remove the SVG element containing the graph
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