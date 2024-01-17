// feeds.js
import './FeedEventSource.js';

import { initializeFeedsDisplay } from './FeedInitializer.js';

// Initialize the feeds display when the window loads
window.onload = initializeFeedsDisplay;