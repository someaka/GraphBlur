import { getApiBaseUrl } from '../../src/utils/apiConfig.js';

const baseUrl = getApiBaseUrl();

describe('Login and Feeds Functionality', () => {
  before(() => {
    // Perform a login to set the session cookie
    cy.request('POST', `${baseUrl}/login`, { username: 'curaSed', password: '010203' })
      .then((response) => {
        // Check that the 'sessionid' cookie is set
        expect(response.headers['set-cookie']).to.exist;
        // Save the cookie value to use in subsequent requests
        const cookie = response.headers['set-cookie'].find(c => c.startsWith('sessionid='));
        expect(cookie).to.exist;
        cy.setCookie('sessionid', cookie.split(';')[0].split('=')[1]);
      });
  });

  it('should display feeds after successful login', () => {
    // Visit the feeds page, the session cookie should be sent automatically
    cy.visit('/feeds.html');
    // Add assertions to check for the presence of feeds on the page
    cy.get('#feedsContainer').should('be.visible');
  });

  it('should successfully fetch feeds with a valid session', () => {
    // Visit the base page, the session cookie should be sent automatically
    cy.visit('/');
    // Attempt to fetch feeds, which should succeed with a valid session cookie
    cy.request('/api/feeds').then((response) => {
      expect(response.status).to.eq(200);
      // Perform additional checks on the response body if necessary
    });
  });

  // Add more tests as needed for other aspects of the login functionality
});