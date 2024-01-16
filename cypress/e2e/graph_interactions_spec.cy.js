import { getApiBaseUrl } from '../../src/utils/apiConfig.js';

const baseUrl = getApiBaseUrl();

describe('Graph Interactions', () => {
  it('Should have NODE_ENV set to production', () => {
    expect(Cypress.env('NODE_ENV')).to.equal('production');
  });

  it('should login, click on a feed, and verify nodes are displayed', () => {
    // Log the base URL to the console
    console.log('Base URL:', baseUrl);

    // Intercept the API call that fetches the feeds before starting the login process
    cy.intercept('GET', `${baseUrl}/feeds`).as('getFeeds');

    // Intercept the API call that fetches the articles for the clicked feed
    cy.intercept('POST', `${baseUrl}/fetch-articles`).as('fetchArticles');

    // Start the login process
    cy.visit('/');
    cy.get('#inputUsername').type('curaSed');
    cy.get('#inputPassword').type('010203');
    cy.get('#formLogin').submit();

    // Wait for the redirect to feeds page
    cy.url().should('include', '/feeds.html');

    // Wait for the feeds to be loaded
    cy.wait('@getFeeds');

    // Click on the first feed in the list
    cy.get('#feedslist div').first().should('be.visible').click();

    // Wait for the articles to be loaded
    cy.wait('@fetchArticles');

    // Now that the articles are loaded, check for the presence of nodes
    cy.get('#graph-container').find('circle').should('exist');
  });
});