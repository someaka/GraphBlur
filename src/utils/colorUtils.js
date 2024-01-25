export function generateColors(feeds) {
    // Calculate the total number of feeds
    const totalFeeds = Object.keys(feeds).length;

    // Define the hue ranges for pastel blue and green
    const hueBlueStart = 180, hueBlueEnd = 220; // Range for pastel blues
    const hueGreenStart = 80, hueGreenEnd = 140; // Range for pastel greens

    // Calculate the number of feeds that will be assigned each color
    const totalBlueFeeds = Math.ceil(totalFeeds / 2);
    const totalGreenFeeds = Math.floor(totalFeeds / 2);

    // Calculate the step size for each range
    const stepSizeBlue = (hueBlueEnd - hueBlueStart) / totalBlueFeeds;
    const stepSizeGreen = (hueGreenEnd - hueGreenStart) / totalGreenFeeds;

    // Iterate over the feeds and assign a color to each one
    for (const [feedIndex, feed] of Object.entries(feeds)) {
        // Alternate between blue and green ranges
        const isBlue = feedIndex % 2 === 0;
        const colorIndex = Math.floor(feedIndex / 2);
        const hue = isBlue
            ? hueBlueStart + (colorIndex * stepSizeBlue) % 360
            : hueGreenStart + (colorIndex * stepSizeGreen) % 360;

        // Create a pastel color with the calculated hue
        const saturation = 60; // Saturation for pastel colors
        const lightness = 85; // Lightness for pastel colors
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

        // Add the color to the feed object
        feed.color = color;
    }

    return feeds;
}