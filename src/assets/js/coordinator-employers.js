let coordinatorEmployers = [];
let coordinatorEmployerSearchTerm = '';

function escapeCoordinatorEmployerHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCoordinatorEmployerDisplayName(employer) {
  return `${employer.firstName || ''} ${employer.lastName || ''}`.trim()
    || employer.companyName
    || employer.email
    || 'Unnamed Employer';
}

function createCoordinatorEmployerCard(employer) {
  const assignedStudents = employer.assignedStudents || [];
  const assignedStudentsMarkup = assignedStudents.length
    ? assignedStudents.map((student) => `
        <span class="coordinator-employer-student-chip">
          ${escapeCoordinatorEmployerHtml(student.name)}
        </span>
      `).join('')
    : '<span class="applications-empty-state">No students assigned yet.</span>';

  return `
    <div class="application-card">
      <div class="application-card-main">
        <div class="application-card-header">
          <span class="application-card-title">${escapeCoordinatorEmployerHtml(getCoordinatorEmployerDisplayName(employer))}</span>
          <span class="status-badge completed">${assignedStudents.length} Student${assignedStudents.length === 1 ? '' : 's'}</span>
        </div>
        <div class="application-card-email">${escapeCoordinatorEmployerHtml(employer.email || 'No employer email available')}</div>
        <div class="coordinator-report-meta">
          <span class="coordinator-report-meta-line"><strong>Assigned Students:</strong></span>
        </div>
        <div class="coordinator-employer-student-list">
          ${assignedStudentsMarkup}
        </div>
      </div>
    </div>
  `;
}

function updateCoordinatorEmployerSummary(employers) {
  const employerCountElement = document.getElementById('coordinatorEmployerCount');
  const assignedStudentCountElement = document.getElementById('coordinatorEmployerAssignedStudentCount');

  if (employerCountElement) {
    employerCountElement.textContent = String(employers.length);
  }

  if (assignedStudentCountElement) {
    const assignedStudentCount = employers.reduce((total, employer) => total + (employer.assignedStudents?.length || 0), 0);
    assignedStudentCountElement.textContent = String(assignedStudentCount);
  }
}

function bindCoordinatorEmployerSearch() {
  const searchInput = document.getElementById('coordinatorEmployerSearch');
  if (!searchInput || searchInput.dataset.bound === 'true') return;

  searchInput.dataset.bound = 'true';
  searchInput.addEventListener('input', () => {
    coordinatorEmployerSearchTerm = searchInput.value.trim().toLowerCase();
    renderCoordinatorEmployersList();
  });
}

function renderCoordinatorEmployersList() {
  const listElement = document.getElementById('coordinatorEmployerList');
  if (!listElement) return;

  updateCoordinatorEmployerSummary(coordinatorEmployers);
  bindCoordinatorEmployerSearch();

  const filteredEmployers = coordinatorEmployers.filter((employer) => {
    if (!coordinatorEmployerSearchTerm) {
      return true;
    }

    const employerName = getCoordinatorEmployerDisplayName(employer).toLowerCase();
    const employerEmail = (employer.email || '').toLowerCase();
    const assignedStudentNames = (employer.assignedStudents || [])
      .map((student) => student.name.toLowerCase())
      .join(' ');

    return employerName.includes(coordinatorEmployerSearchTerm)
      || employerEmail.includes(coordinatorEmployerSearchTerm)
      || assignedStudentNames.includes(coordinatorEmployerSearchTerm);
  });

  if (!filteredEmployers.length) {
    listElement.innerHTML = '<div class="applications-empty-state">No employers match the current search.</div>';
    return;
  }

  listElement.innerHTML = filteredEmployers.map(createCoordinatorEmployerCard).join('');
}

async function renderCoordinatorEmployers() {
  const listElement = document.getElementById('coordinatorEmployerList');
  if (!listElement) return;

  listElement.innerHTML = '<div class="applications-empty-state">Loading employers...</div>';

  try {
    const [employersSnapshot, studentsSnapshot] = await Promise.all([
      firebase.firestore().collection('users').where('role', '==', 'employer').get(),
      firebase.firestore().collection('users').where('role', '==', 'student').get()
    ]);

    const assignedStudentsByEmployerId = new Map();
    studentsSnapshot.docs.forEach((doc) => {
      const student = doc.data();
      const employerId = student.assignedEmployerId;
      if (!employerId) return;

      const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'Unnamed Student';
      const currentStudents = assignedStudentsByEmployerId.get(employerId) || [];
      currentStudents.push({
        uid: doc.id,
        name: studentName,
        email: student.email || ''
      });
      assignedStudentsByEmployerId.set(employerId, currentStudents);
    });

    coordinatorEmployers = employersSnapshot.docs.map((doc) => {
      const employer = {
        uid: doc.id,
        ...doc.data(),
        assignedStudents: assignedStudentsByEmployerId.get(doc.id) || []
      };

      employer.assignedStudents.sort((left, right) => left.name.localeCompare(right.name));
      return employer;
    }).sort((left, right) => {
      return getCoordinatorEmployerDisplayName(left).localeCompare(getCoordinatorEmployerDisplayName(right));
    });

    if (!coordinatorEmployers.length) {
      updateCoordinatorEmployerSummary([]);
      listElement.innerHTML = '<div class="applications-empty-state">No employer accounts were found.</div>';
      return;
    }

    renderCoordinatorEmployersList();
  } catch (error) {
    console.error('Unable to load employers:', error);
    listElement.innerHTML = '<div class="applications-empty-state">Unable to load employers right now.</div>';
  }
}

window.initializeCoordinatorEmployersPage = function() {
  const listElement = document.getElementById('coordinatorEmployerList');
  if (!listElement) return;

  renderCoordinatorEmployers();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeCoordinatorEmployersPage();
});
