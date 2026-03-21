const COORDINATOR_EVALUATION_COLLECTION = 'evaluationReports';
let coordinatorEvaluationStudents = [];
let coordinatorEvaluationReports = new Map();
let coordinatorEvaluationSearchTerm = '';
let coordinatorEvaluationStatusFilter = 'all';

function escapeCoordinatorEvaluationHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCoordinatorEvaluationCurrentUser() {
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

function getCoordinatorEvaluationRequestedDateLabel(report) {
  const requestedAt = report?.requestedAt instanceof Date
    ? report.requestedAt
    : report?.requestedAt?.toDate
      ? report.requestedAt.toDate()
      : null;
  if (!requestedAt) {
    return 'Not requested yet';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(requestedAt);
}

function getCoordinatorEvaluationState(student, report) {
  if (report?.status === 'submitted' && report?.reportUrl) {
    return {
      badgeLabel: 'Received',
      badgeClassName: 'completed',
      buttonLabel: 'View Evaluation',
      buttonType: 'link',
      buttonDisabled: false,
      note: `Evaluation received from ${student.assignedEmployerName || 'the assigned employer'}.`
    };
  }

  if (report?.status === 'requested') {
    return {
      badgeLabel: 'Requested',
      badgeClassName: 'in-process',
      buttonLabel: 'Requested',
      buttonType: 'button',
      buttonDisabled: true,
      note: `Request sent to ${student.assignedEmployerName || 'the assigned employer'} on ${getCoordinatorEvaluationRequestedDateLabel(report)}.`
    };
  }

  if (!student.assignedEmployerId) {
    return {
      badgeLabel: 'No Employer',
      badgeClassName: 'neutral',
      buttonLabel: 'No Employer Assigned',
      buttonType: 'button',
      buttonDisabled: true,
      note: 'Assign an employer to this student before requesting an evaluation report.'
    };
  }

  return {
    badgeLabel: 'Ready',
    badgeClassName: 'pending',
    buttonLabel: 'Request Evaluation Report',
    buttonType: 'button',
    buttonDisabled: false,
    note: `Ready to request an evaluation from ${student.assignedEmployerName || 'the assigned employer'}.`
  };
}

function matchesCoordinatorEvaluationStatus(student, report, filterValue) {
  if (filterValue === 'all') {
    return true;
  }

  if (filterValue === 'received') {
    return report?.status === 'submitted' && Boolean(report.reportUrl);
  }

  if (filterValue === 'requested') {
    return report?.status === 'requested';
  }

  if (filterValue === 'no_employer') {
    return !student.assignedEmployerId;
  }

  return !report?.status && Boolean(student.assignedEmployerId);
}

function filterCoordinatorEvaluationStudents(students, reports) {
  return students.filter((student) => {
    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim().toLowerCase();
    const studentEmail = (student.email || '').toLowerCase();
    const report = reports.get(student.uid);
    const searchMatch = !coordinatorEvaluationSearchTerm
      || studentName.includes(coordinatorEvaluationSearchTerm)
      || studentEmail.includes(coordinatorEvaluationSearchTerm);

    return searchMatch && matchesCoordinatorEvaluationStatus(student, report, coordinatorEvaluationStatusFilter);
  });
}

function updateCoordinatorEvaluationSummary(students, reports) {
  let readyCount = 0;
  let requestedCount = 0;
  let receivedCount = 0;

  students.forEach((student) => {
    const report = reports.get(student.uid);

    if (report?.status === 'submitted' && report?.reportUrl) {
      receivedCount += 1;
      return;
    }

    if (report?.status === 'requested') {
      requestedCount += 1;
      return;
    }

    if (student.assignedEmployerId) {
      readyCount += 1;
    }
  });

  const totalElement = document.getElementById('coordinatorEvaluationTotalCount');
  const readyElement = document.getElementById('coordinatorEvaluationReadyCount');
  const requestedElement = document.getElementById('coordinatorEvaluationRequestedCount');
  const receivedElement = document.getElementById('coordinatorEvaluationReceivedCount');

  if (totalElement) totalElement.textContent = String(students.length);
  if (readyElement) readyElement.textContent = String(readyCount);
  if (requestedElement) requestedElement.textContent = String(requestedCount);
  if (receivedElement) receivedElement.textContent = String(receivedCount);
}

function syncCoordinatorEvaluationFilters() {
  const searchInput = document.getElementById('coordinatorEvaluationSearch');
  const statusSelect = document.getElementById('coordinatorEvaluationStatusFilter');

  if (searchInput) {
    searchInput.value = coordinatorEvaluationSearchTerm;
  }

  if (statusSelect) {
    statusSelect.value = coordinatorEvaluationStatusFilter;
  }
}

function createCoordinatorEvaluationCard(student, report) {
  const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';
  const state = getCoordinatorEvaluationState(student, report);
  const employerName = student.assignedEmployerName || 'No employer assigned';
  const coordinatorName = student.assignedCoordinatorName || 'No coordinator assigned';
  const submittedFileName = report?.reportFileName || 'Evaluation document';

  const actionMarkup = state.buttonType === 'link'
    ? `<a class="quick-view-btn coordinator-evaluation-action-btn" href="${escapeCoordinatorEvaluationHtml(report.reportUrl)}" target="_blank" rel="noopener noreferrer">${escapeCoordinatorEvaluationHtml(state.buttonLabel)}</a>`
    : `
      <button
        class="quick-view-btn coordinator-evaluation-action-btn"
        type="button"
        data-coordinator-evaluation-request="${escapeCoordinatorEvaluationHtml(student.uid)}"
        ${state.buttonDisabled ? 'disabled' : ''}
      >
        ${escapeCoordinatorEvaluationHtml(state.buttonLabel)}
      </button>
    `;

  return `
    <div class="application-card coordinator-student-card">
      <div class="application-card-main">
        <div class="application-card-header">
          <span class="application-card-title">${escapeCoordinatorEvaluationHtml(studentName)}</span>
          <span class="status-badge ${escapeCoordinatorEvaluationHtml(state.badgeClassName)}">${escapeCoordinatorEvaluationHtml(state.badgeLabel)}</span>
        </div>
        <div class="application-card-email">${escapeCoordinatorEvaluationHtml(student.email || 'No email available')}</div>
        <div class="evaluation-meta">
          <span class="evaluation-meta-line"><strong>Employer:</strong> ${escapeCoordinatorEvaluationHtml(employerName)}</span>
          <span class="evaluation-meta-line"><strong>Coordinator:</strong> ${escapeCoordinatorEvaluationHtml(coordinatorName)}</span>
          <span class="evaluation-meta-line"><strong>Document:</strong> ${escapeCoordinatorEvaluationHtml(report?.reportUrl ? submittedFileName : 'No evaluation uploaded')}</span>
        </div>
        <div class="application-card-note">${escapeCoordinatorEvaluationHtml(state.note)}</div>
      </div>
      <div class="application-card-actions evaluation-action-stack coordinator-evaluation-action-stack">
        ${actionMarkup}
      </div>
    </div>
  `;
}

async function fetchCoordinatorEvaluationData() {
  const [studentsSnapshot, evaluationsSnapshot] = await Promise.all([
    firebase.firestore()
      .collection('users')
      .where('role', '==', 'student')
      .get(),
    firebase.firestore()
      .collection(COORDINATOR_EVALUATION_COLLECTION)
      .get()
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

  const reports = new Map(
    evaluationsSnapshot.docs.map((doc) => [doc.id, doc.data()])
  );

  return { students, reports };
}

function bindCoordinatorEvaluationFilters() {
  const searchInput = document.getElementById('coordinatorEvaluationSearch');
  const statusSelect = document.getElementById('coordinatorEvaluationStatusFilter');

  syncCoordinatorEvaluationFilters();

  if (searchInput && searchInput.dataset.bound !== 'true') {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', () => {
      coordinatorEvaluationSearchTerm = searchInput.value.trim().toLowerCase();
      renderCoordinatorEvaluationList();
    });
  }

  if (statusSelect && statusSelect.dataset.bound !== 'true') {
    statusSelect.dataset.bound = 'true';
    statusSelect.addEventListener('change', () => {
      coordinatorEvaluationStatusFilter = statusSelect.value;
      renderCoordinatorEvaluationList();
    });
  }
}

async function requestCoordinatorEvaluation(studentUid) {
  const student = coordinatorEvaluationStudents.find((entry) => entry.uid === studentUid);
  if (!student || !student.assignedEmployerId) {
    return;
  }

  try {
    const currentUser = await getCoordinatorEvaluationCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to request evaluation reports.');
    }

    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';

    await firebase.firestore()
      .collection(COORDINATOR_EVALUATION_COLLECTION)
      .doc(studentUid)
      .set({
        studentId: studentUid,
        studentName: studentName,
        studentEmail: student.email || '',
        assignedCoordinatorId: student.assignedCoordinatorId || '',
        assignedCoordinatorName: student.assignedCoordinatorName || '',
        employerId: student.assignedEmployerId,
        employerName: student.assignedEmployerName || '',
        requestedByCoordinatorId: currentUser.uid,
        requestedByCoordinatorEmail: currentUser.email || '',
        status: 'requested',
        requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    const existingReport = coordinatorEvaluationReports.get(studentUid) || {};
    coordinatorEvaluationReports.set(studentUid, {
      ...existingReport,
      studentId: studentUid,
      studentName: studentName,
      studentEmail: student.email || '',
      employerId: student.assignedEmployerId,
      employerName: student.assignedEmployerName || '',
      status: 'requested',
      requestedAt: new Date()
    });

    renderCoordinatorEvaluationList();
  } catch (error) {
    console.error('Unable to request evaluation report:', error);
    window.alert(error.message || 'Unable to request the evaluation report right now.');
  }
}

function bindCoordinatorEvaluationActions() {
  document.querySelectorAll('[data-coordinator-evaluation-request]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      const studentUid = button.getAttribute('data-coordinator-evaluation-request');
      if (!studentUid || button.disabled) {
        return;
      }

      button.disabled = true;
      button.textContent = 'Requesting...';
      await requestCoordinatorEvaluation(studentUid);
    });
  });
}

function renderCoordinatorEvaluationList() {
  const list = document.getElementById('coordinatorEvaluationList');
  if (!list) return;

  bindCoordinatorEvaluationFilters();
  updateCoordinatorEvaluationSummary(coordinatorEvaluationStudents, coordinatorEvaluationReports);

  if (!coordinatorEvaluationStudents.length) {
    list.innerHTML = '<div class="applications-empty-state">No student users were found in the database.</div>';
    return;
  }

  const filteredStudents = filterCoordinatorEvaluationStudents(
    coordinatorEvaluationStudents,
    coordinatorEvaluationReports
  );

  if (!filteredStudents.length) {
    list.innerHTML = '<div class="applications-empty-state">No students match the current search or status filter.</div>';
    return;
  }

  list.innerHTML = filteredStudents
    .map((student) => createCoordinatorEvaluationCard(student, coordinatorEvaluationReports.get(student.uid)))
    .join('');

  bindCoordinatorEvaluationActions();
}

async function renderCoordinatorEvaluations() {
  const list = document.getElementById('coordinatorEvaluationList');
  if (!list) return;

  list.innerHTML = '<div class="applications-empty-state">Loading evaluation requests...</div>';

  try {
    const { students, reports } = await fetchCoordinatorEvaluationData();
    coordinatorEvaluationStudents = students;
    coordinatorEvaluationReports = reports;
    renderCoordinatorEvaluationList();
  } catch (error) {
    console.error('Unable to load coordinator evaluations:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load evaluation reports right now.</div>';
  }
}

window.initializeCoordinatorEvaluationReportPages = function() {
  const list = document.getElementById('coordinatorEvaluationList');
  if (!list) return;

  renderCoordinatorEvaluations();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeCoordinatorEvaluationReportPages();
});
