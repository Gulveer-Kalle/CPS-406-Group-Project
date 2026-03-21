const COORDINATOR_WORK_TERM_REPORT_COLLECTION = 'workTermReports';
const COORDINATOR_WORK_TERM_REPORT_SETTINGS_COLLECTION = 'settings';
const COORDINATOR_WORK_TERM_REPORT_SETTINGS_DOC = 'workTermReports';
const COORDINATOR_WORK_TERM_REPORT_GRADE_OPTIONS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

let coordinatorWorkTermStudents = [];
let coordinatorWorkTermLatestReports = new Map();
let coordinatorWorkTermSearchTerm = '';
let coordinatorWorkTermStatusFilter = 'all';

function escapeCoordinatorWorkTermHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCoordinatorWorkTermReportDateValue(report) {
  return report?.uploadedAt?.toDate ? report.uploadedAt.toDate().getTime() : 0;
}

function getCoordinatorWorkTermStatusPresentation(report) {
  if (!report?.reportUrl) {
    return { label: 'Not Submitted', className: 'rejected' };
  }

  return { label: 'Submitted', className: 'completed' };
}

function buildCoordinatorGradeOptions(selectedGrade) {
  const defaultOption = '<option value="">Select grade</option>';
  const gradeOptions = COORDINATOR_WORK_TERM_REPORT_GRADE_OPTIONS.map((grade) => {
    const isSelected = selectedGrade === grade ? ' selected' : '';
    return `<option value="${grade}"${isSelected}>${grade}</option>`;
  }).join('');

  return `${defaultOption}${gradeOptions}`;
}

function createCoordinatorWorkTermReportCard(student, report) {
  const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';
  const status = getCoordinatorWorkTermStatusPresentation(report);
  const hasReport = Boolean(report?.reportUrl);
  const selectedGrade = report?.assignedGrade || report?.coordinatorGradeDraft || '';
  const draftCopy = selectedGrade
    ? `Saved grade: ${selectedGrade}.`
    : hasReport
      ? 'Select a grade and click Complete to save it for the student.'
      : 'This student has not submitted a work term report yet.';

  return `
    <div class="application-card coordinator-report-card" data-report-student-uid="${escapeCoordinatorWorkTermHtml(student.uid)}" data-report-doc-id="${escapeCoordinatorWorkTermHtml(report?.id || '')}">
      <div class="application-card-main">
        <div class="application-card-header">
          <span class="application-card-title">${escapeCoordinatorWorkTermHtml(studentName)}</span>
          <span class="status-badge ${escapeCoordinatorWorkTermHtml(status.className)}">${escapeCoordinatorWorkTermHtml(status.label)}</span>
        </div>
        <div class="application-card-email">${escapeCoordinatorWorkTermHtml(student.email || 'No email available')}</div>
        <div class="coordinator-report-meta">
          <span class="coordinator-report-meta-line"><strong>Upload:</strong> ${escapeCoordinatorWorkTermHtml(report?.uploadMonthYear || 'No report uploaded')}</span>
          <span class="coordinator-report-meta-line"><strong>Company:</strong> ${escapeCoordinatorWorkTermHtml(report?.companyName || 'Not submitted')}</span>
          <span class="coordinator-report-meta-line"><strong>Job Title:</strong> ${escapeCoordinatorWorkTermHtml(report?.jobTitle || 'Not submitted')}</span>
        </div>
        <div class="coordinator-report-actions">
          ${hasReport ? `<a class="quick-view-btn" href="${escapeCoordinatorWorkTermHtml(report.reportUrl)}" target="_blank" rel="noopener noreferrer">View</a>` : '<span class="application-card-note">No report file</span>'}
          <select class="coordinator-grade-select" data-coordinator-grade-select ${hasReport ? '' : 'disabled'}>
            ${buildCoordinatorGradeOptions(selectedGrade)}
          </select>
          <button class="btn-primary coordinator-grade-complete-btn" type="button" data-coordinator-grade-complete ${hasReport ? '' : 'disabled'}>Complete</button>
        </div>
        <div class="application-card-note">${escapeCoordinatorWorkTermHtml(draftCopy)}</div>
      </div>
    </div>
  `;
}

async function fetchCoordinatorWorkTermReportData() {
  const [studentsSnapshot, reportsSnapshot] = await Promise.all([
    firebase.firestore().collection('users').where('role', '==', 'student').get(),
    firebase.firestore().collection(COORDINATOR_WORK_TERM_REPORT_COLLECTION).get()
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

  const latestReports = new Map();
  reportsSnapshot.docs.forEach((doc) => {
    const report = { id: doc.id, ...doc.data() };
    const userId = report.userId;
    if (!userId) return;

    const currentLatest = latestReports.get(userId);
    if (!currentLatest || getCoordinatorWorkTermReportDateValue(report) > getCoordinatorWorkTermReportDateValue(currentLatest)) {
      latestReports.set(userId, report);
    }
  });

  return { students, latestReports };
}

function updateCoordinatorWorkTermSummary(students, latestReports) {
  let submittedCount = 0;

  students.forEach((student) => {
    if (latestReports.get(student.uid)?.reportUrl) {
      submittedCount += 1;
    }
  });

  const submittedElement = document.getElementById('coordinatorReportSubmittedCount');
  const notSubmittedElement = document.getElementById('coordinatorReportNotSubmittedCount');

  if (submittedElement) {
    submittedElement.textContent = String(submittedCount);
  }

  if (notSubmittedElement) {
    notSubmittedElement.textContent = String(students.length - submittedCount);
  }
}

function bindCoordinatorWorkTermFilters() {
  const searchInput = document.getElementById('coordinatorWorkTermSearch');
  const statusFilter = document.getElementById('coordinatorWorkTermStatusFilter');

  if (searchInput && searchInput.dataset.bound !== 'true') {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', () => {
      coordinatorWorkTermSearchTerm = searchInput.value.trim().toLowerCase();
      renderCoordinatorWorkTermReportList();
    });
  }

  if (statusFilter && statusFilter.dataset.bound !== 'true') {
    statusFilter.dataset.bound = 'true';
    statusFilter.addEventListener('change', () => {
      coordinatorWorkTermStatusFilter = statusFilter.value;
      renderCoordinatorWorkTermReportList();
    });
  }
}

function renderCoordinatorWorkTermReportList() {
  const list = document.getElementById('coordinatorWorkTermReportList');
  if (!list) return;

  updateCoordinatorWorkTermSummary(coordinatorWorkTermStudents, coordinatorWorkTermLatestReports);
  bindCoordinatorWorkTermFilters();

  if (!coordinatorWorkTermStudents.length) {
    list.innerHTML = '<div class="applications-empty-state">No student users were found in the database.</div>';
    return;
  }

  const filteredStudents = coordinatorWorkTermStudents.filter((student) => {
    const report = coordinatorWorkTermLatestReports.get(student.uid);
    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim().toLowerCase();
    const statusLabel = getCoordinatorWorkTermStatusPresentation(report).label.toLowerCase();

    const matchesName = !coordinatorWorkTermSearchTerm || studentName.includes(coordinatorWorkTermSearchTerm);
    const matchesStatus = coordinatorWorkTermStatusFilter === 'all' || statusLabel === coordinatorWorkTermStatusFilter;

    return matchesName && matchesStatus;
  });

  if (!filteredStudents.length) {
    list.innerHTML = '<div class="applications-empty-state">No reports match the current search.</div>';
    return;
  }

  list.innerHTML = filteredStudents
    .map((student) => createCoordinatorWorkTermReportCard(student, coordinatorWorkTermLatestReports.get(student.uid)))
    .join('');

  bindCoordinatorWorkTermGradeActions();
}

function bindCoordinatorWorkTermGradeActions() {
  const completeButtons = document.querySelectorAll('[data-coordinator-grade-complete]');

  completeButtons.forEach((button) => {
    if (button.dataset.bound === 'true') return;

    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      const card = button.closest('[data-report-student-uid]');
      const reportDocId = card?.getAttribute('data-report-doc-id');
      const gradeSelect = card?.querySelector('[data-coordinator-grade-select]');
      const selectedGrade = gradeSelect?.value || '';

      if (!card || !reportDocId) {
        return;
      }

      if (!selectedGrade) {
        alert('Select a grade before clicking Complete.');
        return;
      }

      button.disabled = true;
      button.textContent = 'Saving...';

      try {
        await firebase.firestore().collection(COORDINATOR_WORK_TERM_REPORT_COLLECTION).doc(reportDocId).set({
          assignedGrade: selectedGrade,
          coordinatorGradeDraft: selectedGrade,
          gradeStatus: 'posted',
          gradeUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          coordinatorGradeDraftUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await renderCoordinatorWorkTermReports();
      } catch (error) {
        console.error('Unable to save draft grade:', error);
        alert('Unable to save the grade draft right now.');
        button.disabled = false;
        button.textContent = 'Complete';
      }
    });
  });
}

async function renderCoordinatorWorkTermReports() {
  const list = document.getElementById('coordinatorWorkTermReportList');
  if (!list) return;

  list.innerHTML = '<div class="applications-empty-state">Loading student work term reports...</div>';

  try {
    const { students, latestReports } = await fetchCoordinatorWorkTermReportData();
    coordinatorWorkTermStudents = students;
    coordinatorWorkTermLatestReports = latestReports;
    renderCoordinatorWorkTermReportList();
  } catch (error) {
    console.error('Unable to load coordinator work term reports:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load work term reports right now.</div>';
  }
}

function setCoordinatorDueDateMessage(message, isError = false) {
  const messageElement = document.getElementById('coordinatorDueDateMessage');
  if (!messageElement) return;

  messageElement.hidden = !message;
  messageElement.textContent = message;
  messageElement.style.color = isError ? '#b91c1c' : '#166534';
}

function isValidCoordinatorDueDateFormat(value) {
  return /^\d{2} [A-Z]{3} \d{4}$/.test(value);
}

async function renderCoordinatorDueDateCard() {
  const dueDateDisplay = document.getElementById('coordinatorCurrentDueDate');
  const dueDateInput = document.getElementById('coordinatorDueDateInput');

  if (!dueDateDisplay || !dueDateInput) return;

  try {
    const settingsDoc = await firebase.firestore()
      .collection(COORDINATOR_WORK_TERM_REPORT_SETTINGS_COLLECTION)
      .doc(COORDINATOR_WORK_TERM_REPORT_SETTINGS_DOC)
      .get();

    const dueDateValue = settingsDoc.exists ? settingsDoc.data().dueDateDisplay || '' : '';
    dueDateDisplay.textContent = dueDateValue || 'No Due Date';
    dueDateInput.value = dueDateValue || '';
  } catch (error) {
    console.error('Unable to load coordinator due date:', error);
    dueDateDisplay.textContent = 'No Due Date';
  }
}

function bindCoordinatorDueDateUpdate() {
  const updateButton = document.getElementById('coordinatorDueDateUpdateBtn');
  const dueDateInput = document.getElementById('coordinatorDueDateInput');

  if (!updateButton || !dueDateInput || updateButton.dataset.bound === 'true') return;

  updateButton.dataset.bound = 'true';
  updateButton.addEventListener('click', async () => {
    const dueDateValue = dueDateInput.value.trim();

    if (dueDateValue && !isValidCoordinatorDueDateFormat(dueDateValue)) {
      setCoordinatorDueDateMessage('Use the format DD MON YYYY, for example 12 MAR 2026.', true);
      return;
    }

    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    setCoordinatorDueDateMessage('');

    try {
      await firebase.firestore()
        .collection(COORDINATOR_WORK_TERM_REPORT_SETTINGS_COLLECTION)
        .doc(COORDINATOR_WORK_TERM_REPORT_SETTINGS_DOC)
        .set({
          dueDateDisplay: dueDateValue,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      await renderCoordinatorDueDateCard();
      setCoordinatorDueDateMessage(dueDateValue ? 'Due date updated.' : 'Due date cleared.');
    } catch (error) {
      console.error('Unable to update coordinator due date:', error);
      setCoordinatorDueDateMessage('Unable to update the due date right now.', true);
    }

    updateButton.disabled = false;
    updateButton.textContent = 'Update';
  });
}

window.initializeCoordinatorWorkTermReportPages = function() {
  const list = document.getElementById('coordinatorWorkTermReportList');
  if (!list) return;

  bindCoordinatorDueDateUpdate();
  renderCoordinatorDueDateCard();
  renderCoordinatorWorkTermReports();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeCoordinatorWorkTermReportPages();
});
