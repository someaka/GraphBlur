// Get references to DOM elements
const formLogin = document.getElementById("formLogin");
const submitButton = document.getElementById("submitButton");
const inputUsername = document.getElementById("inputUsername");
const inputPassword = document.getElementById("inputPassword");
const loginStatusMessage = document.getElementById("loginStatusMessage"); // Add this line to reference the status message element

// Define async function to handle login
async function login(username, password) {
    try {
      const response = await axios.post('/api/login', { username, password });
      // Check if the response indicates that the login was not authenticated
      if (!response.data.authenticated) {
        // Handle the case where the server indicates invalid credentials
        // Safely access the errors property
        const errorMessage = response.data.error || 'An error occurred during login.';
        loginStatusMessage.textContent = errorMessage;
        loginStatusMessage.style.display = 'block'; // Show error message
      } else {
        console.log('Login successful:', response.data);
        // Handle successful login, e.g., redirecting the user or storing login data
        loginStatusMessage.style.display = 'none'; // Hide error message
        window.location.href = 'feeds.html';

      }
    } catch (error) {
      // Handle other errors, such as network issues or server errors
      loginStatusMessage.textContent = error.response?.data?.error || 'An error occurred. Please try again.';
      loginStatusMessage.style.display = 'block'; // Show error message
      console.error('Error during login:', error);
    }
  }

// Add event listener to form
formLogin.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = inputUsername.value;
    const password = inputPassword.value || ""; // Password is optional

    submitButton.disabled = true;
    submitButton.textContent = "Loading...";

    try {
        await login(username, password);
        // Redirect or update UI after successful login
    } catch (error) {
        // Handle error, possibly already handled inside login function
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit";
    }
});
