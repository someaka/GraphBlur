import { setNegativeEdges, negativeEdges } from "./Graph/graph";
import { updateForceSettings } from "./Graph/graphologySigma.js";


function updateOutput(slider, output, scale, precision, scaleType) {
    const value = slider.value;
    let scaledValue;

    if (scaleType === 'log') {
        // Convert the linear range to a logarithmic scale
        const minLog = Math.log(scale.min);
        const maxLog = Math.log(scale.max);
        const scaleLog = (maxLog - minLog) / (slider.max - slider.min);
        scaledValue = Math.exp(minLog + scaleLog * (value - slider.min));
    } else {
        // Linear scale
        scaledValue = scale.min + (value / 100) * (scale.max - scale.min);
    }

    output.textContent = scaledValue.toFixed(precision);
}


// Event listener for the forces button toggle
document.getElementById('forcesButton').addEventListener('click', function () {
    var forceSettings = document.getElementById('forceSettings');
    var articles = document.getElementById('articles');
    if (forceSettings.style.display === 'none') {
        forceSettings.style.display = 'block';
        articles.style.display = 'none';
    } else {
        forceSettings.style.display = 'none';
        articles.style.display = 'block';
    }
});



function initializeSliders() {
    // Find all sliders with the class 'slider'
    const sliders = document.querySelectorAll('.slider');

    sliders.forEach(slider => {
        // Get the associated output element
        const outputId = slider.getAttribute('data-output');
        const output = document.getElementById(outputId);

        // Get the scale, precision, and scale type from data attributes
        const scale = {
            min: parseFloat(slider.getAttribute('data-scale-min')),
            max: parseFloat(slider.getAttribute('data-scale-max')),
            factor: parseFloat(slider.getAttribute('data-scale-factor'))
        };
        const precision = parseInt(slider.getAttribute('data-precision'), 10);
        const scaleType = slider.getAttribute('data-scale-type');

        // Calculate the slider's default position based on its logical default value
        let defaultPosition;
        if (scaleType === 'log') {
            const minLog = Math.log(scale.min);
            const maxLog = Math.log(scale.max);
            const scaleLog = (maxLog - minLog) / (slider.max - slider.min);
            // Calculate position for default value on a logarithmic scale
            const defaultValue = parseFloat(output.textContent);
            defaultPosition = (Math.log(defaultValue) - minLog) / scaleLog + parseFloat(slider.min);
        } else {
            // Calculate position for default value on a linear scale
            const defaultValue = parseFloat(output.textContent);
            defaultPosition = ((defaultValue - scale.min) / (scale.max - scale.min)) * 100;
        }
        slider.value = defaultPosition;

        // Update the output when the slider value changes
        slider.addEventListener('input', () => {
            updateOutput(slider, output, scale, precision, scaleType);
            // After updating the output, call the function to update the simulation settings
            updateForceSettings({
                gravity: parseFloat(document.getElementById('gravityOutput').textContent),
                repulsion: parseFloat(document.getElementById('repulsionOutput').textContent),
                attraction: parseFloat(document.getElementById('attractionOutput').textContent),
                inertia: parseFloat(document.getElementById('inertiaOutput').textContent),
                maxMove: parseFloat(document.getElementById('maxMoveOutput').textContent)
            });
        });

        // Set the initial output value
        updateOutput(slider, output, scale, precision, scaleType);
    });
}


function initializeOptions() {
    const negativeEdgesToggle = document.getElementById('negativeEdgesToggle');
    negativeEdgesToggle.checked = negativeEdges;
    negativeEdgesToggle.addEventListener('change', function () {
        // Call the setter function with the new checkbox value
        setNegativeEdges(negativeEdgesToggle.checked);
    });

    // Initialize the sliders and other settings
    initializeSliders();
}

document.addEventListener('DOMContentLoaded', initializeOptions);
