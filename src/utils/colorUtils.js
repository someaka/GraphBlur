import chroma from 'chroma-js';

/**
 * @param {ArrayLike<any> | { [s: string]: any; }} feeds
 */
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
        const isBlue = Number(feedIndex) % 2 === 0;
        const colorIndex = Math.floor(Number(feedIndex) / 2);
        const hue = isBlue
            ? hueBlueStart + (colorIndex * stepSizeBlue)
            : hueGreenStart + (colorIndex * stepSizeGreen);

        // Create a pastel color with the calculated hue
        const saturation = 60; // Saturation for pastel colors
        const lightness = 85; // Lightness for pastel colors
        const color = `hsl(${hue % 360}, ${saturation}%, ${lightness}%)`;

        // Add the color to the feed object
        feed.color = color;
    }

    return feeds;
}


export function getColorFromString(color) {
    // Extract the hue, saturation, and lightness components from the color string
    const hslMatch = color.match(/hsl\(([^,]+),\s*([^,]+)%,\s*([^,]+)%\)/);
    if (!hslMatch) {
        console.error('Invalid HSL color string:', color);
        return '#000'; // Fallback to black if the color string is invalid
    }

    // Normalize the hue to be between 0 and 360
    const rawHue = parseFloat(hslMatch[1]);
    const hue = rawHue % 360;
    const saturation = parseFloat(hslMatch[2]);
    const lightness = parseFloat(hslMatch[3]);

    // logger.log("Hue:", hue, "Saturation:", saturation, "Lightness:", lightness);

    // Use Chroma.js to construct a valid HSL color
    const hslColor = chroma.hsl(hue, saturation / 100, lightness / 100).css();
    return hslColor;
}

export function getStringFromColor(color) {
    // Convert the Chroma.js color object to HSL and destructure it into components
    const [hue, saturation, lightness] = chroma(color).hsl();

    // Normalize the hue to be between 0 and 360
    const normalizedHue = hue % 360;

    // Construct a valid HSL color string
    const hslColorString = `hsl(${normalizedHue}, ${saturation * 100}%, ${lightness * 100}%)`;
    return hslColorString;
}