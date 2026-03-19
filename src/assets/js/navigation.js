// Navigation JavaScript - Shared utility for all dashboards

document.addEventListener('DOMContentLoaded', function() {
console.log('Navigation loaded');
  
  // Validate userRole on dashboard load
  if (!localStorage.getItem('userRole')) {
    console.warn('No userRole found, redirecting to login');
    window.location.href = '../pages/login.html';
    return;
  }
  
  // Initialize navigation if nav items exist
  initializeNavigation();
  
  // Initialize logout if logout button exists
  initializeLogout();
});

// Navigation functionality - supports both local sections and external subscreens
function initializeNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const dashboardSection = document.getElementById('dashboard-section');
  const subscreenContainer = document.getElementById('subscreen-container');
  
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const url = this.getAttribute('data-url');
      
      // Remove active from all nav items
      navItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
      
      if (url === 'dashboard') {
        // Show local dashboard, hide subscreen
        if (dashboardSection) {
          dashboardSection.classList.add('active');
        }
        if (subscreenContainer) {
          subscreenContainer.classList.remove('active');
        }
        return;
      }
      
      // Load external subscreen
      if (subscreenContainer && url) {
        loadSubscreen(url, subscreenContainer);
        if (dashboardSection) {
          dashboardSection.classList.remove('active');
        }
      }
    });
  });
}

// Load external HTML into container with loading spinner
async function loadSubscreen(url, container) {
  // Show loading spinner
  container.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading ${url}...</p>
    </div>
  `;
  container.classList.add('active');
  
  try {
    const role = localStorage.getItem('userRole') || 'student';
    const prefixedUrl = `${role}-${url}.html`;
    const fullUrl = `../pages/sub-pages/${prefixedUrl}`;
    console.log('Loading subscreen - Role:', role, 'URL:', fullUrl);
    const response = await fetch(fullUrl);

    if (!response.ok) throw new Error(`Failed to load ${prefixedUrl}`);

    const html = await response.text();
    container.innerHTML = html;
    console.log('Subscreen loaded successfully:', prefixedUrl);
    
    // Re-initialize after load
    setTimeout(() => {
      initializeQuickViewButtons();
      initializeActionButtons();
    }, 200);
    
  } catch (error) {
    console.error('LoadSubscreen error:', error);
    container.innerHTML = `
      <div class="error-message">
        <h3>Error Loading Screen</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" class="btn-primary">Reload</button>
      </div>
    `;
  }
}

// Logout functionality
function initializeLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      firebase.auth().signOut().then(() => {
        window.location.href = '../pages/login.html';
      }).catch((error) => {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
      });
    });
  }
}

// Quick View button functionality
function initializeQuickViewButtons() {
  const quickViewBtns = document.querySelectorAll('.quick-view-btn');
  quickViewBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const termItem = this.closest('.term-item');
      const season = termItem.querySelector('.term-season')?.textContent || '';
      const employer = termItem.querySelector('.term-employer')?.textContent || '';
      const grade = termItem.querySelector('.term-grade')?.textContent || '';
      
      alert(`Quick View\n\nTerm: ${season}\nEmployer: ${employer}\n${grade}`);
    });
  });
}

// Action buttons functionality
function initializeActionButtons(actionsConfig = {}) {
  const actionBtns = document.querySelectorAll('.action-btn');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const actionText = this.querySelector('.action-text')?.textContent;
      if (!actionText) return;
      
      if (actionsConfig[actionText]) {
        actionsConfig[actionText]();
        return;
      }
      
      // Default handlers
      switch(actionText) {
        case 'Review Applications':
        case 'View Applications':
          const appsNav = document.querySelector('[data-url="applications"], [data-section="applications"]');
          if (appsNav) appsNav.click();
          break;
        default:
          console.log(`Action: ${actionText}`);
      }
    });
  });
}


// Quick Action nav buttons (data-nav attribute)
// Runs after DOM is ready; also called after subscreen loads
function initializeNavButtons() {
  const navBtns = document.querySelectorAll('.action-btn[data-nav]');
  navBtns.forEach(btn => {
    // Avoid double-binding
    if (btn.dataset.navBound) return;
    btn.dataset.navBound = 'true';
    btn.addEventListener('click', function () {
      const target = this.getAttribute('data-nav');
      const navItem = document.querySelector(`.nav-item[data-url="${target}"]`);
      if (navItem) navItem.click();
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initializeNavButtons();

  // Student dashboard: coordinator / employer header buttons
  const coordBtn = document.getElementById('viewCoordinatorBtn');
  if (coordBtn) {
    coordBtn.addEventListener('click', function () {
      alert('My Coordinator\n\nName: Dr. Jane Smith\nEmail: j.smith@university.ca\nPhone: (416) 555-0101');
    });
  }
  const empBtn = document.getElementById('viewEmployerBtn');
  if (empBtn) {
    empBtn.addEventListener('click', function () {
      alert('My Current Employer\n\nCompany: Tech Corp Inc.\nSupervisor: Alex Johnson\nEmail: a.johnson@techcorp.com');
    });
  }

  // Coordinator announcement button
  const announcementBtn = document.getElementById('announcementBtn');
  if (announcementBtn) {
    announcementBtn.addEventListener('click', function () {
      const msg = prompt('Send Announcement to All Students:\n\nEnter your message:');
      if (msg && msg.trim()) {
        alert(`Announcement sent successfully!\n\n"${msg.trim()}"`);
      }
    });
  }
});
