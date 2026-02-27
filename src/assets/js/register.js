// Current selected role
let selectedRole = 'student';

// Role descriptions
const roleDescriptions = {
  student: 'Student member access',
  coordinator: 'Program coordinator access',
  employer: 'Employer partner access'
};

// Select role function
function selectRole(role) {
  selectedRole = role;
  
  // Update active button
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-role="${role}"]`).classList.add('active');
  
  // Update role description
  document.getElementById('roleDescription').textContent = roleDescriptions[role];
  
  // Update submit button text
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.textContent = `Create Account as ${role.charAt(0).toUpperCase() + role.slice(1)}`;
}

// Password visibility toggle
function togglePasswordVisibility(form) {
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
  const registerForm = document.getElementById('registerForm');
  
  if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const firstName = document.getElementById('firstName').value.trim();
      const lastName = document.getElementById('lastName').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      const successMessage = document.getElementById('successMessage');
      
      // Validate inputs
      if (!firstName || !lastName || !email || !password) {
        alert('Please fill in all fields');
        return;
      }
      
      // Validate first name
      if (firstName.length < 1) {
        alert('Please enter your first name');
        return;
      }
      
      // Validate last name
      if (lastName.length < 1) {
        alert('Please enter your last name');
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
      }
      
      // Validate password strength
      if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
      }
      
      // Show success message
      successMessage.style.display = 'block';
      successMessage.textContent = `✓ Account created successfully as ${selectedRole}!`;
      
      // Simulate registration process
      setTimeout(() => {
        alert(`Account created for ${firstName} ${lastName} (${email}) as ${selectedRole}`);
        // TODO: Replace with actual backend registration
        // window.location.href = 'login.html';
      }, 1000);
    });
  }
});
