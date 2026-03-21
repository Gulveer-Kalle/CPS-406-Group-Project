const COORDINATOR_APPLICATION_COLLECTION = 'applications';
let coordinatorApplicationOutsideClickBound = false;
let coordinatorApplicationSearchTerm = '';
let coordinatorApplicationStatusFilter = 'all';
let coordinatorApplicationStudents = [];
let coordinatorApplicationMap = new Map();

function getCoordinatorStatusPresentation(status, hasUploadedDocuments) {
  if (!hasUploadedDocuments && (!status || status === 'pending')) {
    return { label: 'Not Submitted', className: 'rejected' };
  }

  switch (status) {
    case 'approved':
      return { label: 'Approved', className: 'completed' };
    case 'rejected':
      return { label: 'Rejected', className: 'rejected' };
    case 'in_process':
      return { label: 'In Process', className: 'in-process' };
    case 'pending':
    default:
      return { label: 'Pending', className: 'pending' };
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDocumentLink(label, url, fileName) {
  if (!url) {
    return `<span class="application-card-note">${escapeHtml(label)}: Not uploaded</span>`;
  }

  return `
    <span>
      <span class="application-document-label">${escapeHtml(label)}:</span>
      <a class="quick-view-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(fileName || `View ${label}`)}
      </a>
    </span>
  `;
}

function createApplicationCard(student, applicationDoc) {
  const hasResume = Boolean(applicationDoc?.resumeUrl);
  const hasCoverLetter = Boolean(applicationDoc?.coverLetterUrl);
  const hasUploadedDocuments = hasResume || hasCoverLetter;
  const normalizedStatus = applicationDoc?.coordinatorStatus || applicationDoc?.status || 'pending';
  const status = getCoordinatorStatusPresentation(normalizedStatus, hasUploadedDocuments);
  const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';

  return `
    <div class="application-card" data-student-uid="${escapeHtml(student.uid)}">
      <div class="application-menu-wrap" data-application-menu-wrap>
        <button class="application-menu-btn" type="button" data-application-menu-btn aria-label="Open application actions">...</button>
        <div class="application-menu" data-application-menu>
          <button class="application-menu-item" type="button" data-application-status="approved">Approve</button>
          <button class="application-menu-item" type="button" data-application-status="rejected">Reject</button>
          <button class="application-menu-item" type="button" data-application-status="in_process">In Process</button>
        </div>
      </div>

      <div class="application-card-main">
        <div class="application-card-header">
          <span class="application-card-title">${escapeHtml(studentName)}</span>
          <span class="status-badge ${escapeHtml(status.className)}" data-application-badge>${escapeHtml(status.label)}</span>
        </div>
        <div class="application-card-email">${escapeHtml(student.email || 'No email available')}</div>
        <div class="application-document-row">
          ${buildDocumentLink('Resume', applicationDoc?.resumeUrl, applicationDoc?.resumeFileName)}
          ${buildDocumentLink('Cover Letter', applicationDoc?.coverLetterUrl, applicationDoc?.coverLetterFileName)}
        </div>
        <div class="application-card-note" data-application-note>
          ${hasUploadedDocuments ? 'Documents uploaded and ready for coordinator review.' : 'This student has not uploaded application documents yet.'}
        </div>
      </div>
    </div>
  `;
}

function matchesCoordinatorStatusFilter(applicationDoc, selectedStatus) {
  if (selectedStatus === 'all') {
    return true;
  }

  const hasUploadedDocuments = Boolean(applicationDoc?.resumeUrl || applicationDoc?.coverLetterUrl);
  const normalizedStatus = applicationDoc?.coordinatorStatus || applicationDoc?.status || 'pending';

  if (selectedStatus === 'not_submitted') {
    return !hasUploadedDocuments;
  }

  if (!hasUploadedDocuments && selectedStatus !== 'not_submitted') {
    return false;
  }

  return normalizedStatus === selectedStatus;
}

function filterCoordinatorApplications(students, applicationsMap) {
  return students.filter((student) => {
    const applicationDoc = applicationsMap.get(student.uid);
    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim().toLowerCase();
    const searchMatch = !coordinatorApplicationSearchTerm || studentName.includes(coordinatorApplicationSearchTerm);
    const statusMatch = matchesCoordinatorStatusFilter(applicationDoc, coordinatorApplicationStatusFilter);
    return searchMatch && statusMatch;
  });
}

function syncCoordinatorApplicationFilterInputs() {
  const searchInput = document.getElementById('coordinatorApplicationSearch');
  const statusSelect = document.getElementById('coordinatorApplicationStatusFilter');

  if (searchInput) {
    searchInput.value = coordinatorApplicationSearchTerm;
  }

  if (statusSelect) {
    statusSelect.value = coordinatorApplicationStatusFilter;
  }
}

function updateCoordinatorApplicationSummary(students, applicationsMap) {
  const totalStudents = students.length;
  let uploadedCount = 0;
  let openCount = 0;
  let approvedCount = 0;

  students.forEach((student) => {
    const applicationDoc = applicationsMap.get(student.uid);
    const hasUploadedDocuments = Boolean(applicationDoc?.resumeUrl || applicationDoc?.coverLetterUrl);
    const status = applicationDoc?.coordinatorStatus || applicationDoc?.status || 'pending';

    if (hasUploadedDocuments) {
      uploadedCount += 1;
    }

    if (hasUploadedDocuments && (status === 'pending' || status === 'in_process')) {
      openCount += 1;
    }

    if (status === 'approved') {
      approvedCount += 1;
    }
  });

  const totalElement = document.getElementById('coordinatorApplicationsTotal');
  const uploadedElement = document.getElementById('coordinatorApplicationsUploaded');
  const openElement = document.getElementById('coordinatorApplicationsOpen');
  const approvedElement = document.getElementById('coordinatorApplicationsApproved');

  if (totalElement) totalElement.textContent = String(totalStudents);
  if (uploadedElement) uploadedElement.textContent = String(uploadedCount);
  if (openElement) openElement.textContent = String(openCount);
  if (approvedElement) approvedElement.textContent = String(approvedCount);
}

async function fetchCoordinatorApplicationData() {
  const [studentsSnapshot, applicationsSnapshot] = await Promise.all([
    firebase.firestore().collection('users').where('role', '==', 'student').get(),
    firebase.firestore().collection(COORDINATOR_APPLICATION_COLLECTION).get()
  ]);

  const students = studentsSnapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data()
  }));

  students.sort((left, right) => {
    const leftName = `${left.firstName || ''} ${left.lastName || ''}`.trim().toLowerCase();
    const rightName = `${right.firstName || ''} ${right.lastName || ''}`.trim().toLowerCase();
    return leftName.localeCompare(rightName);
  });

  const applicationsMap = new Map(
    applicationsSnapshot.docs.map((doc) => [doc.id, doc.data()])
  );

  return { students, applicationsMap };
}

function bindCoordinatorApplicationMenus() {
  const menuButtons = document.querySelectorAll('[data-application-menu-btn]');

  if (!coordinatorApplicationOutsideClickBound) {
    coordinatorApplicationOutsideClickBound = true;
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-application-menu-wrap]')) {
        return;
      }

      document.querySelectorAll('[data-application-menu].active').forEach((menu) => {
        menu.classList.remove('active');
      });
    });
  }

  menuButtons.forEach((button) => {
    if (button.dataset.bound === 'true') return;

    button.dataset.bound = 'true';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = button.parentElement.querySelector('[data-application-menu]');

      document.querySelectorAll('[data-application-menu].active').forEach((activeMenu) => {
        if (activeMenu !== menu) {
          activeMenu.classList.remove('active');
        }
      });

      if (menu) {
        menu.classList.toggle('active');
      }
    });
  });
}

async function updateCoordinatorApplicationStatus(studentUid, nextStatus, card) {
  const badge = card.querySelector('[data-application-badge]');
  const note = card.querySelector('[data-application-note]');
  const menu = card.querySelector('[data-application-menu]');
  const hasUploadedDocuments = Boolean(card.querySelector('a.quick-view-btn'));
  const presentation = getCoordinatorStatusPresentation(nextStatus, hasUploadedDocuments);

  try {
    await firebase.firestore().collection(COORDINATOR_APPLICATION_COLLECTION).doc(studentUid).set({
      coordinatorStatus: nextStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (badge) {
      badge.className = `status-badge ${presentation.className}`;
      badge.textContent = presentation.label;
    }

    if (note) {
      note.textContent = hasUploadedDocuments
        ? `Coordinator marked this application as ${presentation.label.toLowerCase()}.`
        : `No documents uploaded. Coordinator marked this application as ${presentation.label.toLowerCase()}.`;
    }

    if (menu) {
      menu.classList.remove('active');
    }

    renderCoordinatorApplications();
  } catch (error) {
    console.error('Unable to update coordinator application status:', error);
    alert('Unable to update application status right now.');
  }
}

function bindCoordinatorApplicationStatusActions() {
  const actionButtons = document.querySelectorAll('[data-application-status]');

  actionButtons.forEach((button) => {
    if (button.dataset.bound === 'true') return;

    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const card = button.closest('[data-student-uid]');
      const studentUid = card?.getAttribute('data-student-uid');
      const nextStatus = button.getAttribute('data-application-status');

      if (!card || !studentUid || !nextStatus) return;
      updateCoordinatorApplicationStatus(studentUid, nextStatus, card);
    });
  });
}

function bindCoordinatorApplicationFilters() {
  const searchInput = document.getElementById('coordinatorApplicationSearch');
  const statusSelect = document.getElementById('coordinatorApplicationStatusFilter');

  syncCoordinatorApplicationFilterInputs();

  if (searchInput && searchInput.dataset.bound !== 'true') {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', () => {
      coordinatorApplicationSearchTerm = searchInput.value.trim().toLowerCase();
      renderCoordinatorApplicationsList();
    });
  }

  if (statusSelect && statusSelect.dataset.bound !== 'true') {
    statusSelect.dataset.bound = 'true';
    statusSelect.addEventListener('change', () => {
      coordinatorApplicationStatusFilter = statusSelect.value;
      renderCoordinatorApplicationsList();
    });
  }
}

function renderCoordinatorApplicationsList() {
  const list = document.getElementById('coordinatorApplicationsList');
  if (!list) return;

  const students = coordinatorApplicationStudents;
  const applicationsMap = coordinatorApplicationMap;

  updateCoordinatorApplicationSummary(students, applicationsMap);
  bindCoordinatorApplicationFilters();

  if (!students.length) {
    list.innerHTML = '<div class="applications-empty-state">No student users were found in the database.</div>';
    return;
  }

  const filteredStudents = filterCoordinatorApplications(students, applicationsMap);

  if (!filteredStudents.length) {
    list.innerHTML = '<div class="applications-empty-state">No students match the current search or status filter.</div>';
    return;
  }

  list.innerHTML = filteredStudents.map((student) => createApplicationCard(student, applicationsMap.get(student.uid))).join('');
  bindCoordinatorApplicationMenus();
  bindCoordinatorApplicationStatusActions();
}

async function renderCoordinatorApplications() {
  const list = document.getElementById('coordinatorApplicationsList');
  if (!list) return;

  list.innerHTML = '<div class="applications-empty-state">Loading student applications...</div>';

  try {
    const { students, applicationsMap } = await fetchCoordinatorApplicationData();
    coordinatorApplicationStudents = students;
    coordinatorApplicationMap = applicationsMap;
    renderCoordinatorApplicationsList();
  } catch (error) {
    console.error('Unable to load coordinator applications:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load student applications right now.</div>';
  }
}

window.initializeCoordinatorApplicationPages = function() {
  renderCoordinatorApplications();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeCoordinatorApplicationPages();
});
