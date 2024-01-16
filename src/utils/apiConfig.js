export function getApiBaseUrl() {
  if (process.env.NODE_ENV === 'production' || (typeof Cypress !== 'undefined' && Cypress.env('NODE_ENV') === 'production')) {
    // In production, use the server's base URL without the /api prefix
    return '';
  } else {
    // In development, use the /api prefix for compatibility with Vite's proxy
    return '/api';
  }
}