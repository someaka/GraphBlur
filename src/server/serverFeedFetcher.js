import axios from 'axios';
// eslint-disable-next-line no-unused-vars
import { serverLogger as logger } from '../logger.js';

const NEWSBLUR_URL = 'https://www.newsblur.com';

class FeedsFetcher {
    constructor() {
        this.isSessionValid = true;
    }

    /**
     * @param {string} url
     * @param {string} sessionCookie
     */
    async fetchWithSessionCookie(url, sessionCookie, options = {}) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': sessionCookie
                },
                withCredentials: true,
                ...options
            });
            return response.data;
        } catch (error) {
            if (!this.isSessionValid || (error.response && error.response.status === 403)) {
                this.isSessionValid = false;
                throw new Error('Session is invalid or expired');
            } else {
                throw error;
            }
        }
    }

    /**
     * @param {string} sessionCookie
     */
    async fetchFeeds(sessionCookie) {
        const url = `${NEWSBLUR_URL}/reader/feeds`;
        const data = await this.fetchWithSessionCookie(url, sessionCookie);
        return data.feeds;
    }

    /**
     * @param {string} sessionCookie
     * @param {string} [feedId]
     * @param {string} [color]
     */
    async fetchStories(sessionCookie, feedId, color, options = {}) {
        const params = new URLSearchParams({
            page: options.page || 1,
            order: options.order || 'newest',
            read_filter: 'unread',
            include_hidden: options.include_hidden || false,
            include_story_content: false.toString()
        }).toString();

        let allUnreadStories = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const url = `${NEWSBLUR_URL}/reader/feed/${feedId}?${params}&page=${page}`;
            const data = await this.fetchWithSessionCookie(url, sessionCookie);
            const stories = data.stories || [];
            allUnreadStories = allUnreadStories.concat(stories);
            hasMore = stories.length > 0;
            page++;
        }

        return allUnreadStories.map(story => ({ ...story, color }));
    }
}

// Singleton instance
const feedsFetcherInstance = new FeedsFetcher();

// Export the instance methods as standalone functions
/**
* @param {string} sessionCookie
*/
const fetchFeeds = (sessionCookie) => feedsFetcherInstance.fetchFeeds(sessionCookie);
// type comments
/**
* @param {string} sessionCookie
* @param {string} feedId
* @param {string} color
*/
const fetchStories = (sessionCookie, feedId, color, options = {}) =>
 feedsFetcherInstance.fetchStories(sessionCookie, feedId, color, options);

// Export the instance methods as standalone functions using object shorthand syntax
export {
    fetchFeeds,
    fetchStories
};