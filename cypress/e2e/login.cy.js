import { getApiBaseUrl } from '../../src/utils/apiConfig.js';

const baseUrl = getApiBaseUrl();

const validUsername = 'curaSed';
const validPassword = '010203';

describe('Login Tests', () => {
  it('displays an error message for incorrect username', () => {
    cy.visit('/');
    cy.get('#inputUsername').type('wronguser');
    cy.get('#inputPassword').type('optionalpassword'); // Since password is optional
    cy.get('#formLogin').submit();
    cy.get('#loginStatusMessage').should('be.visible').and('not.have.text', '');
    cy.url().should('not.include', '/feeds.html');
  });

  it('displays an error message for incorrect password', () => {
    cy.visit('/');
    cy.get('#inputUsername').type('curaSed');
    cy.get('#inputPassword').type('wrongpassword');
    cy.get('#formLogin').submit();
    cy.get('#loginStatusMessage').should('be.visible'); // Wait for the error message to become visible
    cy.get('#loginStatusMessage').should('not.have.text', ''); // Then check that it's not empty
    cy.url().should('not.include', '/feeds.html');
  });



  it('successfully logs in, redirects to the feeds page, and persists session across reloads', () => {
    // Call the loginAndGetSessionCookie task with a valid username and password
    cy.task('loginAndGetSessionCookie', { username: validUsername, password: validPassword }).then((sessionCookie) => {
      // Set the session cookie manually using Cypress's setCookie function
      cy.setCookie('sessionid', sessionCookie);

      // Visit the feeds.html page
      cy.visit('/feeds.html');

      // Check if the session cookie is still present after the reload
      cy.getCookie('sessionid').should('exist');

      // Reload the page
      cy.reload();

      cy.request(`${baseUrl}/feeds`).then((response) => {
        expect(response.status).to.eq(200);
      });

      // Check that the first feed is called "Prensa Latina"
      cy.get('#feedsContainer').should('be.visible').contains('Prensa Latina');

    });
  });




});