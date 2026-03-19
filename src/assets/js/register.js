// Current selected role
let selectedRole = 'student';

// Role descriptions
const roleDescriptions = {
  student: 'Student member access',
  coordinator: 'Program coordinator access',
  employer: 'Employer partner access'
};

function hasSequentialChars(password) {
  const normalized = password.toLowerCase();

  for (let i = 0; i < normalized.length - 2; i++) {
    const segment = normalized.slice(i, i + 3);
    if (!/^[a-z0-9]{3}$/.test(segment)) {
      continue;
    }

    const first = segment.charCodeAt(0);
    const second = segment.charCodeAt(1);
    const third = segment.charCodeAt(2);

    const ascending = second === first + 1 && third === second + 1;
    const descending = second === first - 1 && third === second - 1;

    if (ascending || descending) {
      return true;
    }
  }

  return false;
}

function hasRepeatedChars(password) {
  return /(.)\1/.test(password);
}

function validatePassword(password) {
  const hasStartedTyping = password.length > 0;

  return {
    length: password.length > 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    number: /\d/.test(password),
    repeated: hasStartedTyping && !hasRepeatedChars(password),
    sequential: hasStartedTyping && !hasSequentialChars(password)
  };
}

function updatePasswordChecklist(results) {
  const ruleElements = {
    length: document.getElementById('rule-length'),
    uppercase: document.getElementById('rule-uppercase'),
    lowercase: document.getElementById('rule-lowercase'),
    special: document.getElementById('rule-special'),
    number: document.getElementById('rule-number'),
    repeated: document.getElementById('rule-repeated'),
    sequential: document.getElementById('rule-sequential')
  };

  Object.entries(ruleElements).forEach(([ruleName, element]) => {
    if (!element) {
      return;
    }

    element.classList.toggle('valid', results[ruleName]);
    element.classList.toggle('invalid', !results[ruleName]);
  });
}

// Select role
function selectRole(role) {

  selectedRole = role;

  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  document.querySelector(`[data-role="${role}"]`).classList.add('active');

  document.getElementById('roleDescription').textContent = roleDescriptions[role];

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.textContent = `Create Account as ${role.charAt(0).toUpperCase() + role.slice(1)}`;
}

// Password visibility toggle
function togglePasswordVisibility(inputId, toggleBtn) {

  const passwordInput = document.getElementById(inputId);

  if (!passwordInput || !toggleBtn) {
    return;
  }

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleBtn.textContent = 'Hide';
  } else {
    passwordInput.type = 'password';
    toggleBtn.textContent = 'Show';
  }

}

// Form submission
document.addEventListener('DOMContentLoaded', function () {

  const registerForm = document.getElementById('registerForm');
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const passwordFeedback = document.getElementById('passwordFeedback');
  let hasOpenedPasswordFeedback = false;

  function runPasswordValidation() {
    const results = validatePassword(passwordInput ? passwordInput.value : '');

    updatePasswordChecklist(results);
    return results;
  }

  function shouldHidePasswordFeedback() {
    const passwordValidation = runPasswordValidation();
    const passwordsMatch =
      !!passwordInput &&
      !!confirmPasswordInput &&
      confirmPasswordInput.value.length > 0 &&
      passwordInput.value === confirmPasswordInput.value;

    return Object.values(passwordValidation).every(Boolean) && passwordsMatch;
  }

  function showPasswordFeedback() {
    hasOpenedPasswordFeedback = true;
    if (passwordFeedback) {
      passwordFeedback.classList.remove('hidden');
    }
    runPasswordValidation();
  }

  function maybeHidePasswordFeedback() {
    setTimeout(() => {
      const activeElement = document.activeElement;
      const focusStayedInPasswordArea =
        activeElement === passwordInput ||
        activeElement === confirmPasswordInput;

      if (!focusStayedInPasswordArea && shouldHidePasswordFeedback() && passwordFeedback) {
        passwordFeedback.classList.add('hidden');
      }
    }, 0);
  }

  if (passwordInput) {
    passwordInput.addEventListener('focus', showPasswordFeedback);
    passwordInput.addEventListener('blur', maybeHidePasswordFeedback);
  }

  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('focus', showPasswordFeedback);
    confirmPasswordInput.addEventListener('blur', maybeHidePasswordFeedback);
  }

  [firstNameInput, lastNameInput, emailInput, passwordInput, confirmPasswordInput].forEach(input => {
    if (input) {
      input.addEventListener('input', function () {
        if (hasOpenedPasswordFeedback) {
          runPasswordValidation();
        }
      });
    }
  });

  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {

      e.preventDefault();

      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      const successMessage = document.getElementById('successMessage');

      // Validate inputs
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
      }

      showPasswordFeedback();
      const passwordValidation = runPasswordValidation();
      if (!Object.values(passwordValidation).every(Boolean)) {
        alert('Please fix the password requirements before creating your account.');
        return;
      }

      if (password !== confirmPassword) {
        alert('Passwords do not match.');
        return;
      }

      try {

        // Use global firebase.auth() and firebase.firestore()
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);

        const uid = userCredential.user.uid;

        await firebase.firestore().collection('users').doc(uid).set({
          firstName: firstName,
          lastName: lastName,
          email: email,
          role: selectedRole,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        successMessage.style.display = 'block';
        successMessage.textContent = `✓ Account created successfully as ${selectedRole}!`;

        setTimeout(() => {
          window.location.href = "login.html";
        }, 1000);

      } catch (error) {

        console.error(error);
        alert(error.message);

      }

    });
  }

});
