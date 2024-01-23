import { serverLogger as logger } from '../logger.js';

import axios from 'axios';
import sanitizeHtml from 'sanitize-html';

import { v4 as uuidv4 } from 'uuid';
import { firefox } from 'playwright';
import { extract } from '@extractus/article-extractor';
import { articleUpdateEmitter } from './events.js';
//import { newsBlurSessionCookie } from './server.js';

let browser;
let articleCache = {};
const userAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Helper function to fetch a single article with retries
// @articles.js
async function fetchArticle(url, retries = 1) {
    if (typeof url !== 'string') {
        logger.error(`Invalid URL: ${url}`);
        return { article: null, status: 'failure', error: 'Invalid URL' };
    }
    let attempt = 0;
    while (attempt < retries) {
        try {
            logger.log(`Attempting to fetch article: ${url}, Attempt: ${attempt + 1}`);
            const response = await axios.get(url, {
                withCredentials: true, // This will include cookies with the request
                headers: { 'User-Agent': userAgent }
            });
            logger.log(`Successfully fetched article: ${url}`);
            return { article: await processArticle(response.data, url), status: 'success' };
        } catch (error) {
            logger.error(`Error fetching article: ${url}, Attempt: ${attempt + 1}, Error: ${error.message}`);
            if (attempt === retries - 1) {
                retryFetchArticle(url); 
                return { article: null, status: 'failure', error: error.message };
            }
            attempt++;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
        }
    }
}


async function fetchArticleContentWithPlaywright(url) {
    if (!browser) {
        browser = await firefox.launch(); // Initialize the browser if it's not already
    }
    const page = await browser.newPage(); // Open a new page
    await page.goto(url, { waitUntil: 'networkidle', timeout: 1000 }); // Navigate to the URL
    const content = await page.content(); // Get the content of the page
    await browser.close(); // Close the browser
    return content; // Return the content
}

function retryFetchArticle(url) {
    fetchArticleContentWithPlaywright(url)
        .then(content => {
            // Assuming 'article' is the object containing the article data
            const article = { url, content };
            articleUpdateEmitter.emit('articleUpdate', article);
        })
        .catch(error => {
            logger.warn('Failed to fetch article:', error);
        });
}




async function processArticle(htmlData, url) {
    try {
        // Log the URL being processed for reference
        //logger.log(`Processing article from URL: ${url}`);

        // Use the extract function from @extractus/article-extractor
        const article = await extract(htmlData, {
            // You can pass additional options if needed
        });

        if (article) {
            // Clean the content
            const cleanedContent = cleanArticleContent(article.content);

            // Log the extracted article title for reference
            //logger.log(`Extracted article title: ${article.title}`);
            return {
                title: article.title,
                text: cleanedContent, // Use the cleaned content
                url: article.url
            };
        } else {
            logger.error('Failed to extract article content. No article data returned.');
            // Return an object with empty strings for title and text
            return {
                title: '',
                text: '',
                url: url // Keep the original URL
            };
        }
    } catch (error) {
        logger.error('An error occurred while extracting the article:', error);
        // Return an object with empty strings for title and text
        return {
            title: '',
            text: '',
            url: url // Keep the original URL
        };
    }
}


function cleanArticleContent(content) {
    // Define the allowed tags and attributes
    const clean = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            'img': ['src', 'alt']
        },
        // Do not allow any CSS styles
        allowedStyles: {}
    });

    return clean; // Return the cleaned content
}

async function fetchArticlesWithContentForFeeds(feedIds) {
    // If a single feedId is provided, convert it to an array
    if (!Array.isArray(feedIds)) {
        feedIds = [feedIds];
    }

    const allArticlesWithContent = [];

    for (const feedId of feedIds) {
        const unreadStories = articleCache[feedId] || [];
        const validUrls = unreadStories.filter(story => typeof story.story_permalink === 'string' && story.story_permalink.startsWith('http'));

        // Fetch content for each valid URL and assign a UUID
        const articlesWithContent = await Promise.all(validUrls.map(async story => {
            const articleContent = await fetchArticle(story.story_permalink);
            return {
                ...articleContent,
                id: uuidv4(), // Generate a UUID as the ID
                feedId: feedId // Include the feedId for later reference
            };
        }));

        allArticlesWithContent.push(...articlesWithContent);
    }

    return allArticlesWithContent;
}



async function closeBrowser() {
    if (browser) await browser.close();
}

process.on('exit', closeBrowser);
  


export {
    articleCache,
    fetchArticle,
    fetchArticleContentWithPlaywright,
    retryFetchArticle,
    processArticle,
    cleanArticleContent,
    fetchArticlesWithContentForFeeds,
    closeBrowser
};