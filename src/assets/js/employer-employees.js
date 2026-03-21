let employerAssignedEmployees = [];
let employerEmployeeSearchTerm = '';

function escapeEmployerEmployeeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmployerCurrentUser() {
  return new Promise((resolve) => {
    const auth = firebase.auth();

    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

function createEmployerEmployeeCard(student) {
  const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';
  const studentEmail = student.email || '';
  const assignedCoordinator = student.assignedCoordinatorName || 'No coordinator assigned';

  return `
    <div class="application-card coordinator-student-card">
      <div class="application-card-main">
        <div class="application-card-header">
          <span class="application-card-title">${escapeEmployerEmployeeHtml(studentName)}</span>
          <span class="status-badge completed">Assigned</span>
        </div>
        <div class="application-card-email">${escapeEmployerEmployeeHtml(studentEmail || 'No email available')}</div>
        <div class="coordinator-report-meta">
          <span class="coordinator-report-meta-line"><strong>Employer:</strong> ${escapeEmployerEmployeeHtml(student.assignedEmployerName || 'Current employer')}</span>
          <span class="coordinator-report-meta-line"><strong>Coordinator:</strong> ${escapeEmployerEmployeeHtml(assignedCoordinator)}</span>
        </div>
      </div>
      <div class="application-card-actions">
        <button
          class="quick-view-btn student-email-btn"
          type="button"
          data-employer-student-email="${escapeEmployerEmployeeHtml(studentEmail)}"
        >
          Email
        </button>
      </div>
    </div>
  `;
}

function updateEmployerEmployeeSummary(students) {
  const employeeCountElement = document.getElementById('employerAssignedEmployeeCount');
  const emailCountElement = document.getElementById('employerAssignedEmployeeEmailCount');

  if (employeeCountElement) {
    employeeCountElement.textContent = String(students.length);
  }

  if (emailCountElement) {
    emailCountElement.textContent = String(students.filter((student) => Boolean(student.email)).length);
  }
}

function bindEmployerEmployeeSearch() {
  const searchInput = document.getElementById('employerEmployeeSearch');
  if (!searchInput || searchInput.dataset.bound === 'true') return;

  searchInput.dataset.bound = 'true';
  searchInput.addEventListener('input', () => {
    employerEmployeeSearchTerm = searchInput.value.trim().toLowerCase();
    renderEmployerEmployeesList();
  });
}

function bindEmployerEmployeeEmailButtons() {
  document.querySelectorAll('[data-employer-student-email]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      const studentEmail = button.dataset.employerStudentEmail || '';

      if (!studentEmail) {
        window.alert('No student email is available for this account yet.');
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(studentEmail);
          window.alert(`Student email copied:\n\n${studentEmail}`);
          return;
        }
      } catch (error) {
        console.warn('Unable to copy student email to clipboard:', error);
      }

      window.alert(`Student email:\n\n${studentEmail}`);
    });
  });
}

function renderEmployerEmployeesList() {
  const list = document.getElementById('employerEmployeesList');
  if (!list) return;

  updateEmployerEmployeeSummary(employerAssignedEmployees);
  bindEmployerEmployeeSearch();

  const filteredEmployees = employerAssignedEmployees.filter((student) => {
    if (!employerEmployeeSearchTerm) {
      return true;
    }

    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim().toLowerCase();
    const email = (student.email || '').toLowerCase();
    return studentName.includes(employerEmployeeSearchTerm) || email.includes(employerEmployeeSearchTerm);
  });

  if (!filteredEmployees.length) {
    list.innerHTML = '<div class="applications-empty-state">No assigned employees match the current search.</div>';
    return;
  }

  list.innerHTML = filteredEmployees.map(createEmployerEmployeeCard).join('');
  bindEmployerEmployeeEmailButtons();
}

async function renderEmployerEmployees() {
  const list = document.getElementById('employerEmployeesList');
  if (!list) return;

  list.innerHTML = '<div class="applications-empty-state">Loading assigned employees...</div>';

  try {
    const currentUser = await getEmployerCurrentUser();
    if (!currentUser) {
      list.innerHTML = '<div class="applications-empty-state">Unable to determine the current employer.</div>';
      return;
    }

    const employeesSnapshot = await firebase.firestore()
      .collection('users')
      .where('role', '==', 'student')
      .where('assignedEmployerId', '==', currentUser.uid)
      .get();

    employerAssignedEmployees = employeesSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data()
    }));

    employerAssignedEmployees.sort((left, right) => {
      const leftName = `${left.firstName || ''} ${left.lastName || ''}`.trim().toLowerCase();
      const rightName = `${right.firstName || ''} ${right.lastName || ''}`.trim().toLowerCase();
      return leftName.localeCompare(rightName);
    });

    if (!employerAssignedEmployees.length) {
      updateEmployerEmployeeSummary([]);
      list.innerHTML = '<div class="applications-empty-state">No students are currently assigned to this employer.</div>';
      return;
    }

    renderEmployerEmployeesList();
  } catch (error) {
    console.error('Unable to load employer employees:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load assigned employees right now.</div>';
  }
}

window.initializeEmployerEmployeesPage = function() {
  const list = document.getElementById('employerEmployeesList');
  if (!list) return;

  renderEmployerEmployees();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeEmployerEmployeesPage();
});
