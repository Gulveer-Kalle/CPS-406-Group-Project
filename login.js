// Password visibility toggle
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.querySelector('.toggle-password');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleBtn.textContent = 'Hide';
  } else {
    passwordInput.type = 'password';
    toggleBtn.textContent = 'Show';
  }
}

// Form submission
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      const successMessage = document.getElementById('successMessage');
      
      // Validate inputs
      if (!email || !password) {
        alert('Please fill in all fields');
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
      }
      
      // Show success message
      successMessage.style.display = 'block';
      
      // Simulate login process
      setTimeout(() => {
        alert(`Logging in as ${email}`);
        // TODO: Replace with actual backend authentication
        // window.location.href = 'studentDashboard.html';
      }, 1000);
    });
  }
});
