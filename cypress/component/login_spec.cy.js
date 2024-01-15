
describe('Login Component', () => {
  beforeEach(() => {
    // Visit the component index page
    cy.visit('/cypress/support/component-index.html'); // Adjust the path as needed

    // Set up the HTML structure for the login component
    cy.get('body').then((body) => {
      const form = document.createElement('form');
      form.id = 'formLogin';
      form.innerHTML = `
        <input type="text" id="inputUsername" placeholder="Username" />
        <input type="password" id="inputPassword" placeholder="Password" />
        <button type="submit" id="submitButton">Submit</button>
        <div id="loginStatusMessage"></div>
      `;
      body[0].appendChild(form);
    });

    // Dynamically load the client.js script
    cy.get('body').then((body) => {
      const script = document.createElement('script');
      script.src = '/src/client.js';
      script.defer = true;
      body[0].appendChild(script);
    });
  });


  it('successfully logs in with correct username and password', () => {
    // Stub the network request made by the login component
    cy.intercept('POST', '/api/login', {
      statusCode: 200,
      body: { authenticated: true, sessionCookie: 'fake-session-cookie' },
    }).as('loginRequest');

    // Enter username and password
    cy.get('#inputUsername').type('testuser');
    cy.get('#inputPassword').type('password');

    // Submit the form
    cy.get('#formLogin').submit();

    // Assert that the network request was made with the correct credentials
    cy.wait('@loginRequest').its('request.body').should('deep.equal', {
      username: 'testuser',
      password: 'password',
    });

    // Assert that the user is redirected to the feeds page
    cy.location('pathname').should('eq', '/feeds.html');
  });


});