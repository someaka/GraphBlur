import { getApiBaseUrl } from '../../src/utils/apiConfig.js';

const baseUrl = getApiBaseUrl();


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
    // Intercept the login request to check the response headers later
    cy.intercept('POST', `${baseUrl}/login`).as('loginRequest');

    // Visit the login page
    cy.visit('/');

    // Fill in the username and password fields
    cy.get('#inputUsername').type('curaSed');
    cy.get('#inputPassword').type('010203');

    // Submit the form
    cy.get('#formLogin').submit();

    // Wait for the login request to complete and verify redirection to the feeds page
    cy.wait('@loginRequest').then((interception) => {
      // Check if the session cookie is set
      cy.getCookie('sessionid').should('exist');
    })
      .url().should('include', '/feeds.html')
      // After successful login and redirection, test the persistence of the session
      .then(() => {
        // Visit the feeds page
        //cy.visit('/feeds.html');

        // Check if the session cookie is still present after the reload
        cy.getCookie('sessionid').should('exist');

        // Wait for a short delay (e.g., 2000 milliseconds)
        // cy.wait(2000);

        // Reload the page
        cy.reload();

        // Check if the session cookie is still present after the reload
        cy.getCookie('sessionid').should('exist');
      });
  });



});