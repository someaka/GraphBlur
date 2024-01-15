import { serverLogger as logger } from '../logger.js';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

const NEWSBLUR_URL = 'https://www.newsblur.com';

// Initialize axios with cookie jar support
wrapper(axios);
const cookieJar = new CookieJar();

// Function to perform login and store the session cookie
async function login(username, password) {
  logger.log(`Attempting login with username: ${username}`);

  try {
    const response = await axios({
      method: 'post',
      url: `${NEWSBLUR_URL}/api/login`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      jar: cookieJar,
      withCredentials: true
    });

    logger.log("response:", JSON.stringify(response.data));

    if (response.data.errors === null) {
      logger.log('Login successful');
      // Retrieve the session cookie from the cookieJar
      const sessionCookie = cookieJar.getCookieStringSync(NEWSBLUR_URL);
      return { authenticated: true, sessionCookie };
    } else {
      const errorMessage = response.data.errors?.__all__?.[0] || 'An error occurred during login.';
      logger.error('Login failed:', errorMessage);
      return { authenticated: false, error: errorMessage };
    }
  } catch (error) {
    logger.error('Error during login request:', error);
    return { authenticated: false, error: 'Login request failed. Please try again later.' };
  }
}


// Function to handle re-authentication
async function reAuthenticate() {
  try {

    if (!username || !password) {
      throw new Error('No credentials available for re-authentication.');
    }

    const loginResult = await login(username, password);
    if (loginResult.authenticated) {
      // Save the new session cookie
      const sessionCookie = cookieJar.getCookieStringSync(NEWSBLUR_URL);
      return { authenticated: true, sessionCookie };
    } else {
      throw new Error('Re-authentication failed.');
    }
  } catch (error) {
    logger.error('Re-authentication error:', error);
    throw error;
  }
}



export { login, cookieJar, NEWSBLUR_URL, reAuthenticate };