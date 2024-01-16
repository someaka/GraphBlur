import { getApiBaseUrl } from '../../src/utils/apiConfig.js';

const baseUrl = getApiBaseUrl();

describe('Login and Feeds Functionality', () => {
  let sessionCookie = null;

  before(() => {
    // Perform a login to set the session cookie
    cy.request('POST',  `${baseUrl}/login`, { username: 'curaSed', password: '010203' })
      .its('body')
      .then((body) => {
        expect(body).to.have.property('sessionCookie');
        sessionCookie = body.sessionCookie;
      });
  });

  it('should display feeds after successful login', () => {
    // Set the session cookie in localStorage
    cy.visit('/feeds.html'); // Visit the feeds page
    cy.window().then((win) => {
      win.localStorage.setItem('sessionid', sessionCookie);
    });

    // Add assertions to check for the presence of feeds on the page
    cy.get('#feedsContainer').should('be.visible');
  });

  it('should successfully fetch feeds with a valid session', () => {
    // Set the session cookie in localStorage
    cy.visit('/'); // Visit the base page to set localStorage
    cy.window().then((win) => {
      win.localStorage.setItem('sessionid', sessionCookie);
    });

    // Attempt to fetch feeds, which should succeed with a valid session cookie
    cy.request('/api/feeds').then((response) => {
      expect(response.status).to.eq(200);
      // Perform additional checks on the response body if necessary
    });
  });


  // Add more tests as needed for other aspects of the login functionality
});