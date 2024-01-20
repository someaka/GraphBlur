import { getApiBaseUrl } from '../../src/utils/apiConfig.js';

const baseUrl = getApiBaseUrl();

describe('Graph Interactions', () => {

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

    // Wait for the feeds to be loaded with a custom timeout
    cy.wait('@getFeeds', { timeout: 10000 });



    cy.screenshot('before');


    // Click on the first feed in the list
    cy.get('#feedslist div').first().should('be.visible').click();

    // Wait for the articles to be loaded
    cy.wait('@fetchArticles');

    cy.screenshot('after');

    // Get the paths of the screenshots
    cy.task('getBeforeScreenshotPath').then((beforePath) => {
      cy.task('getAfterScreenshotPath').then((afterPath) => {
        // Call the task to compare images
        cy.task('compareSnapshots', {
          before: beforePath,
          after: afterPath,
          threshold: 0.1
        }).then(diffPixels => {
          // Assert based on the number of different pixels
          expect(diffPixels).to.be.greaterThan(0.01);
        });
      });
    });

  });
});