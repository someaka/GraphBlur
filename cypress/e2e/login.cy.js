describe('Login Tests', () => {
  it('successfully logs in and redirects to the feeds page', () => {

    // Intercept the login request to check the response headers later
    cy.intercept('POST', '/api/login').as('loginRequest');

    // Visit the login page
    cy.visit('/');

    // Fill in the username and password fields
    cy.get('#inputUsername').type('curaSed');
    cy.get('#inputPassword').type('010203');

    // Submit the form
    cy.get('#formLogin').submit();

    // Wait for the login request to complete
    cy.wait('@loginRequest').then((interception) => {
      // Check if the session cookie is present in the JSON response body
      expect(interception.response.body).to.have.property('sessionCookie');

      // Check if the session cookie is saved in localStorage
      cy.window().then((win) => {
        const localStorageSessionId = win.localStorage.getItem('sessionid');
        expect(localStorageSessionId).to.equal(interception.response.body.sessionCookie);
      });

      // Verify that the user is redirected to the feeds page
      cy.url().should('include', '/feeds.html');
    });
  });



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
    cy.get('#loginStatusMessage').should('be.visible').and('not.have.text', '');
    cy.url().should('not.include', '/feeds.html');
  });





  it('persists the user session across page navigation and reloads', () => {
    // Perform a login to set the session cookie
    cy.request('POST', '/api/login', { username: 'curaSed', password: '010203' })
      .its('body')
      .then((body) => {
        expect(body).to.have.property('sessionCookie');
        // Save the session cookie in localStorage using the browser's localStorage API
        localStorage.setItem('sessionid', body.sessionCookie);
      });

    // Visit the feeds page
    cy.visit('/feeds.html');

    // Check if the session cookie is present in localStorage
    cy.window().then((win) => {
      const localStorageSessionId = win.localStorage.getItem('sessionid');
      expect(localStorageSessionId).to.be.a('string');
    });

    // Reload the page
    cy.reload();

    // Check if the session cookie is still present in localStorage after the reload
    cy.window().then((winAfterReload) => {
      const localStorageSessionIdAfterReload = winAfterReload.localStorage.getItem('sessionid');
      expect(localStorageSessionIdAfterReload).to.be.a('string');
    });
  });



});