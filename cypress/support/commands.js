// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

import { addMatchImageSnapshotCommand } from '@simonsmith/cypress-image-snapshot/command.js';

addMatchImageSnapshotCommand({
  failureThreshold: 0.03, // threshold for entire image
  failureThresholdType: 'percent', // percent of image or number of pixels
  customDiffConfig: { threshold: 0.1 }, // threshold for each pixel
  capture: 'viewport', // capture viewport in screenshot
});
// ... other custom commands you might have

Cypress.Commands.add('checkSufficientlyDifferent', { prevSubject: 'optional' }, (subject, name, threshold) => {
    cy.matchImageSnapshot(name, {
      failureThreshold: threshold,
      failureThresholdType: 'percent',
      capture: 'fullPage'
    }).then((result) => {
      if (result && result.diffRatio && result.diffRatio < threshold) {
        throw new Error(`Image is not sufficiently different. Difference was only ${result.diffRatio * 100}%.`);
      }
    });
  });