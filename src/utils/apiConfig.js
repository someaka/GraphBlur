// src/utils/apiConfig.js

export function getApiBaseUrl() {
  if (process.env.NODE_ENV === 'production' || Cypress.env('NODE_ENV') === 'production') {
    // In production, use the server's base URL without the /api prefix
    return '';
  } else {
    // In development, use the /api prefix for compatibility with Vite's proxy
    return '/api';
  }
}