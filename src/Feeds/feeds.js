// @ts-nocheck
import './FeedEventSource.js';
import { updateDayNightMode } from '../Graph/graphologySigma.js';   


import { initializeFeedsDisplay } from './FeedInitializer.js';

let DayOrNight = 1;

function toggleDayNightMode() {
    console.log("toggleDayNightMode");
    const body = document.getElementById("bd");

    if (DayOrNight == 1) {
        body.className = body.className.replace("day", "night");
        updateDayNightMode();
        DayOrNight = 0;
    } else if (DayOrNight == 0) {
        body.className = body.className.replace("night", "day");
        updateDayNightMode();
        DayOrNight = 1;
    }

}

window.toggleDayNightMode = toggleDayNightMode;

// Initialize the feeds display when the window loads
window.onload = initializeFeedsDisplay;