import { serverLogger as logger } from '../logger.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reAuthenticate } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_STORE_PATH = path.join(__dirname, 'temp_session_store.json');
const NEWSBLUR_URL = 'https://www.newsblur.com';

let isSessionValid = true;

async function loadSessionCookie() {
    try {
        const data = await fs.promises.readFile(SESSION_STORE_PATH, 'utf8');
        return JSON.parse(data).sessionCookie;
    } catch (error) {
        logger.error('Error loading session cookie:', error);
        throw new Error('Failed to load session cookie.');
    }
}

async function saveSessionCookie(sessionCookie) {
    try {
        await fs.promises.writeFile(SESSION_STORE_PATH, JSON.stringify({ sessionCookie }));
    } catch (error) {
        logger.error('Error saving session cookie:', error);
        throw new Error('Failed to save session cookie.');
    }
}

async function fetchWithSessionCookie(url, options = {}) {
    if (!isSessionValid) {
        const reAuthResult = await reAuthenticate();
        if (reAuthResult.authenticated) {
            await saveSessionCookie(reAuthResult.sessionCookie);
            isSessionValid = true;
        } else {
            throw new Error('Re-authentication failed.');
        }
    }

    const sessionCookie = await loadSessionCookie();
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
        if (error.response && error.response.status === 403) {
            isSessionValid = false;
            throw new Error('Session is invalid. Re-authentication required.');
        } else {
            throw error;
        }
    }
}

async function fetchFeeds() {
    const url = `${NEWSBLUR_URL}/reader/feeds`;
    const data = await fetchWithSessionCookie(url);
    // logger.log('Fetched feeds:', data); // Add logging to see the fetched data
    return data.feeds;
}

async function fetchStories(feedId, options = {}) {
    const params = new URLSearchParams({
        page: options.page || 1,
        order: options.order || 'newest',
        read_filter: 'unread',
        include_hidden: options.include_hidden || false,
        include_story_content: false
    }).toString();

    let allUnreadStories = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const url = `${NEWSBLUR_URL}/reader/feed/${feedId}?${params}&page=${page}`;
        const data = await fetchWithSessionCookie(url);
        const stories = data.stories || [];
        allUnreadStories = allUnreadStories.concat(stories);
        hasMore = stories.length > 0;
        page++;
    }

    //logger.log(`Fetched stories for feed ${feedId}:`, allUnreadStories); // Add logging to see the fetched stories
    return allUnreadStories;
}

export { fetchFeeds, fetchStories };