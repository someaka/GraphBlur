import { getApiBaseUrl } from '../../src/utils/apiConfig.js';


const baseUrl = getApiBaseUrl();

const validUsername = 'curaSed';
const validPassword = '010203';

describe('Test Tests', () => {
    it('uses login to get session cookie and loads feeds.html', () => {
        // Call the login function with a valid username and password
        cy.task('loginAndGetSessionCookie', { username: validUsername, password: validPassword }).then((sessionCookie) => {


            // Set the session cookie manually using Cypress's setCookie function
            cy.setCookie('sessionid', sessionCookie);

            // Visit the feeds.html page
            cy.visit('/feeds.html');
        });
    });
});