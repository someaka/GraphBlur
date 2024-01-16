import { clientLogger as logger } from './logger.js';

const formLogin = document.getElementById("formLogin");
const submitButton = document.getElementById("submitButton");
const inputUsername = document.getElementById("inputUsername");
const inputPassword = document.getElementById("inputPassword");
const loginStatusMessage = document.getElementById("loginStatusMessage");

import { getApiBaseUrl } from './utils/apiConfig.js';

const baseUrl = getApiBaseUrl();


// Helper function to display login errors
function displayLoginError(message) {
  loginStatusMessage.textContent = message;
  loginStatusMessage.classList.add('error'); // Ensure you have an 'error' class in your CSS for styling
  loginStatusMessage.style.display = 'block';
}

// Helper function to reset the submit button
function resetSubmitButton() {
  submitButton.disabled = false;
  submitButton.textContent = "Submit";
}

// Function to handle form submission
async function handleLogin(event) {
  event.preventDefault();
  const username = inputUsername.value.trim();
  const password = inputPassword.value.trim(); // Password is optional

  if (!username) {
    displayLoginError('Please enter a username.');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Loading...";

  try {
    const response = await axios.post(`${baseUrl}/login`,
      { username, password }, { withCredentials: true });
    logger.log("Login response:", response.data);
    if (response.data.authenticated) {
      // Save the session cookie if present and redirect to feeds.html
      if (response.data.sessionCookie) {
        localStorage.setItem('sessionid', response.data.sessionCookie);
      }
      window.location.href = '/feeds.html';
    } else {
      displayLoginError(response.data.error || 'Login failed. Please try again.');
    }
  } catch (error) {
    displayLoginError(error.response?.data?.error || 'An error occurred. Please try again.');
  } finally {
    resetSubmitButton();
  }
}

// Attach event listener to the form
formLogin.addEventListener("submit", handleLogin);

// Optionally, you can clear any previous login status messages when the user focuses on the input fields
[inputUsername, inputPassword].forEach(input => {
  input.addEventListener('focus', () => {
    loginStatusMessage.style.display = 'none';
  });
});


// export {
//   handleLogin,
//   displayLoginError,
//   resetSubmitButton,
//   loginStatusMessage,
//   formLogin,
//   submitButton,
//   inputUsername,
//   inputPassword
// }