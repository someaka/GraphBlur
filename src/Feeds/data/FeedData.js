import axios from 'axios';
import { feedsLogger as logger } from '../../logger.js';
import { getApiBaseUrl } from '../../utils/apiConfig.js';
import { loadArticlesFromEventSource } from '../FeedEventSource.js';


const baseUrl = getApiBaseUrl();

async function fetchFeeds() {
    try {
        const response = await axios.get(`${baseUrl}/feeds`, {
            withCredentials: true // This will include cookies with the request
        });
        return response.data; // axios automatically parses JSON, so we return it directly
    } catch (error) {
        logger.error('Failed to fetch feeds:', error);
        // Depending on how you want to handle errors, you can throw an error or return a specific error object
        return { error: 'Failed to fetch feeds', details: error.response };
    }
}


/**
 * @param {{ id: string; }} feedData
 */
async function loadArticles(feedData) {

    // @ts-ignore
    // eslint-disable-next-line no-undef
    mainContentSpinner.style.display = 'block'; // Show the spinner in the main content

    const { id: feedId } = feedData;

    const selectedFeedElements = document.querySelectorAll('#feedslist div.clicked');
    const selectedFeedIds = Array.from(selectedFeedElements).map(feedEl => feedEl.id);
    //const selectedFeedIdsParam = encodeURIComponent(selectedFeedIds.join(','));

    return loadArticlesFromEventSource(feedId, selectedFeedIds);
}


export { fetchFeeds, loadArticles };