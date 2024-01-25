import { getApiBaseUrl } from '../../src/utils/apiConfig.js';

const baseUrl = getApiBaseUrl();

const validUsername = 'curaSed';
const validPassword = '010203';

describe('Graph Interactions', () => {

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

  it('should login, click on a feed, and verify nodes are displayed', () => {
    // Log the base URL to the console
    // console.log('Base URL:', baseUrl);




    // Intercept the API call that fetches the articles for the clicked feed
    cy.intercept('POST', `${baseUrl}/fetch-articles`).as('fetchArticles');

    // Visit the feeds page, the session cookie should be sent automatically
    cy.visit('/feeds.html');

    cy.request(`${baseUrl}/feeds`).then((response) => {
      expect(response.status).to.eq(200);
    });

    // Add assertions to check for the presence of feeds on the page
    cy.get('#feedsContainer').should('be.visible');




    cy.screenshot('before');


    // Click on the first feed in the list
    cy.get('#feedslist div').first().should('be.visible').click();

    // Wait for the articles to be loaded
    cy.wait('@fetchArticles').then(() => {
      cy.wait(5000);
      cy.screenshot('after');
    });



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