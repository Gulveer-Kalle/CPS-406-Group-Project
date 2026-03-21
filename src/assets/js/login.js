function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.querySelector('.toggle-password');

  if (!passwordInput || !toggleBtn) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleBtn.textContent = 'Hide';
  } else {
    passwordInput.type = 'password';
    toggleBtn.textContent = 'Show';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginErrorMessage = document.getElementById('loginErrorMessage');
  const loginButton = loginForm?.querySelector('.login-btn');
  const successMessage = document.getElementById('successMessage');

  function setLoginError(message) {
    if (!loginErrorMessage) return;
    loginErrorMessage.textContent = message;
    loginErrorMessage.hidden = !message;
  }

  function clearLoginError() {
    setLoginError('');
  }

  emailInput?.addEventListener('input', clearLoginError);
  passwordInput?.addEventListener('input', clearLoginError);

  if (!loginForm || !emailInput || !passwordInput) return;

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    clearLoginError();
    if (successMessage) {
      successMessage.style.display = 'none';
    }

    if (loginButton) {
      loginButton.disabled = true;
    }

    if (!email || !password) {
      setLoginError('Please enter both your email and password.');
      if (loginButton) {
        loginButton.disabled = false;
      }
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLoginError('Please enter a valid email address.');
      if (loginButton) {
        loginButton.disabled = false;
      }
      return;
    }

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;
      const userDoc = await firebase.firestore().doc(`users/${uid}`).get();

      if (!userDoc.exists) {
        throw new Error('User data not found. Please contact support.');
      }

      const userData = userDoc.data();
      const userRole = userData.role;

      localStorage.setItem('userRole', userRole);

      let dashboardUrl = 'student-dashboard.html';
      switch (userRole) {
        case 'student':
          dashboardUrl = 'student-dashboard.html';
          break;
        case 'coordinator':
          dashboardUrl = 'coordinator-dashboard.html';
          break;
        case 'employer':
          dashboardUrl = 'employer-dashboard.html';
          break;
      }

      if (successMessage) {
        successMessage.style.display = 'block';
        successMessage.textContent = 'Login successful! Redirecting...';
      }

      setTimeout(() => {
        window.location.href = dashboardUrl;
      }, 800);
    } catch (error) {
      console.error(error);

      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/invalid-login-credentials'
      ) {
        setLoginError('Incorrect email or password. Please try again.');
      } else {
        setLoginError(error.message || 'Unable to sign in right now. Please try again.');
      }

      passwordInput.focus();
      passwordInput.select();
    } finally {
      if (loginButton) {
        loginButton.disabled = false;
      }
    }
  });
});
