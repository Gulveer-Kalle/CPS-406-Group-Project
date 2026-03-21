const EMPLOYER_EVALUATION_COLLECTION = 'evaluationReports';
const EMPLOYER_EVALUATION_FILE_SIZE_LIMIT = 1024 * 1024;
const EMPLOYER_EVALUATION_ALLOWED_EXTENSIONS = ['pdf'];
const EMPLOYER_EVALUATION_CLOUD_NAME = 'dufndkd8d';
const EMPLOYER_EVALUATION_UPLOAD_PRESET = 'coop_connect_file_upload';
const EMPLOYER_EVALUATION_RAW_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${EMPLOYER_EVALUATION_CLOUD_NAME}/raw/upload`;

let employerEvaluationAssignedStudents = [];
let employerEvaluationPendingReports = [];

function escapeEmployerEvaluationHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmployerEvaluationCurrentUser() {
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

function getEmployerEvaluationFileExtension(fileName) {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function validateEmployerEvaluationFile(file) {
  if (!file) {
    return 'Please choose an evaluation document to upload.';
  }

  const extension = getEmployerEvaluationFileExtension(file.name);
  if (!EMPLOYER_EVALUATION_ALLOWED_EXTENSIONS.includes(extension)) {
    return 'Only PDF files can be uploaded.';
  }

  if (file.size > EMPLOYER_EVALUATION_FILE_SIZE_LIMIT) {
    return 'Evaluation documents must be 1 MB or smaller.';
  }

  return '';
}

function getEmployerEvaluationRequestedLabel(report) {
  const requestedAt = report?.requestedAt?.toDate ? report.requestedAt.toDate() : null;
  if (!requestedAt) {
    return 'Recently requested';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(requestedAt);
}

async function uploadEmployerEvaluationToCloudinary(file, studentId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', EMPLOYER_EVALUATION_UPLOAD_PRESET);
  formData.append('asset_folder', `coop-connect/evaluation-reports/${studentId}`);
  formData.append('tags', `coop-connect,evaluation-report,${studentId}`);
  formData.append('context', `document_type=evaluation_report|student_id=${studentId}`);

  const response = await fetch(EMPLOYER_EVALUATION_RAW_UPLOAD_URL, {
    method: 'POST',
    body: formData
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Cloudinary upload failed.');
  }

  return payload;
}

function updateEmployerEvaluationSummary(assignedStudents, reports) {
  const assignedElement = document.getElementById('employerEvaluationAssignedCount');
  const pendingElement = document.getElementById('employerEvaluationPendingCount');
  const submittedElement = document.getElementById('employerEvaluationSubmittedCount');

  const submittedCount = assignedStudents.filter((student) => {
    const matchingReport = reports.find((report) => report.studentId === student.uid && report.status === 'submitted');
    return Boolean(matchingReport?.reportUrl);
  }).length;

  if (assignedElement) assignedElement.textContent = String(assignedStudents.length);
  if (pendingElement) pendingElement.textContent = String(reports.filter((report) => report.status === 'requested').length);
  if (submittedElement) submittedElement.textContent = String(submittedCount);
}

function createEmployerEvaluationCard(report) {
  const studentName = report.studentName || 'Unnamed Student';
  const requestedLabel = getEmployerEvaluationRequestedLabel(report);

  return `
    <div class="application-card coordinator-student-card" data-employer-evaluation-card="${escapeEmployerEvaluationHtml(report.studentId)}">
      <div class="application-card-main">
        <div class="application-card-header">
          <span class="application-card-title">${escapeEmployerEvaluationHtml(studentName)}</span>
          <span class="status-badge in-process">Requested</span>
        </div>
        <div class="application-card-email">${escapeEmployerEvaluationHtml(report.studentEmail || 'No email available')}</div>
        <div class="evaluation-meta">
          <span class="evaluation-meta-line"><strong>Requested:</strong> ${escapeEmployerEvaluationHtml(requestedLabel)}</span>
          <span class="evaluation-meta-line"><strong>Coordinator:</strong> ${escapeEmployerEvaluationHtml(report.assignedCoordinatorName || 'Coordinator')}</span>
          <span class="evaluation-meta-line"><strong>Company:</strong> ${escapeEmployerEvaluationHtml(report.employerName || 'Current employer')}</span>
        </div>
        <div class="application-card-note">Upload the student evaluation document and submit it. PDF only, maximum size 1 MB. Once submitted, this request will leave this page.</div>
      </div>
      <div class="application-card-actions evaluation-action-stack">
        <div class="employer-evaluation-upload-row">
          <input
            class="hidden-file-input"
            id="employerEvaluationFile-${escapeEmployerEvaluationHtml(report.studentId)}"
            type="file"
            accept=".pdf,application/pdf"
            data-employer-evaluation-file-input="${escapeEmployerEvaluationHtml(report.studentId)}"
          >
          <button
            class="quick-view-btn employer-evaluation-file-btn"
            type="button"
            data-employer-evaluation-file-trigger="${escapeEmployerEvaluationHtml(report.studentId)}"
          >
            Choose File
          </button>
          <span class="report-upload-file-name employer-evaluation-file-status" data-employer-evaluation-file-status>No file selected</span>
        </div>
        <p class="upload-error-message employer-evaluation-inline-error" data-employer-evaluation-error hidden></p>
        <button
          class="btn-primary employer-evaluation-submit-btn"
          type="button"
          data-employer-evaluation-submit="${escapeEmployerEvaluationHtml(report.studentId)}"
          disabled
        >
          Submit Evaluation
        </button>
      </div>
    </div>
  `;
}

function setEmployerEvaluationInlineError(card, message) {
  const errorElement = card.querySelector('[data-employer-evaluation-error]');
  if (!errorElement) return;

  errorElement.textContent = message;
  errorElement.hidden = !message;
}

function updateEmployerEvaluationSubmitButtonState(card) {
  const fileInput = card.querySelector('[data-employer-evaluation-file-input]');
  const submitButton = card.querySelector('[data-employer-evaluation-submit]');

  if (!fileInput || !submitButton) {
    return;
  }

  submitButton.disabled = !fileInput.dataset.selectedName;
}

function bindEmployerEvaluationFileInputs() {
  document.querySelectorAll('[data-employer-evaluation-file-trigger]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const studentId = button.getAttribute('data-employer-evaluation-file-trigger');
      const input = document.getElementById(`employerEvaluationFile-${studentId}`);
      if (input) {
        input.click();
      }
    });
  });

  document.querySelectorAll('[data-employer-evaluation-file-input]').forEach((input) => {
    if (input.dataset.bound === 'true') {
      return;
    }

    input.dataset.bound = 'true';
    input.addEventListener('change', () => {
      const card = input.closest('[data-employer-evaluation-card]');
      const statusElement = card?.querySelector('[data-employer-evaluation-file-status]');
      const [file] = input.files || [];

      if (!card || !statusElement) {
        return;
      }

      if (!file) {
        delete input.dataset.selectedName;
        statusElement.textContent = 'No file selected';
        setEmployerEvaluationInlineError(card, '');
        updateEmployerEvaluationSubmitButtonState(card);
        return;
      }

      const validationMessage = validateEmployerEvaluationFile(file);
      if (validationMessage) {
        input.value = '';
        delete input.dataset.selectedName;
        statusElement.textContent = 'No file selected';
        setEmployerEvaluationInlineError(card, validationMessage);
        updateEmployerEvaluationSubmitButtonState(card);
        return;
      }

      input.dataset.selectedName = file.name;
      statusElement.textContent = file.name;
      setEmployerEvaluationInlineError(card, '');
      updateEmployerEvaluationSubmitButtonState(card);
    });
  });
}

async function submitEmployerEvaluation(studentId, card) {
  const fileInput = card.querySelector('[data-employer-evaluation-file-input]');
  const statusElement = card.querySelector('[data-employer-evaluation-file-status]');
  const submitButton = card.querySelector('[data-employer-evaluation-submit]');
  const reportFile = fileInput?.files?.[0];

  const validationMessage = validateEmployerEvaluationFile(reportFile);
  if (validationMessage) {
    setEmployerEvaluationInlineError(card, validationMessage);
    return;
  }

  setEmployerEvaluationInlineError(card, '');
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';

  try {
    const currentUser = await getEmployerEvaluationCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to submit an evaluation report.');
    }

    const uploadResult = await uploadEmployerEvaluationToCloudinary(reportFile, studentId);

    await firebase.firestore()
      .collection(EMPLOYER_EVALUATION_COLLECTION)
      .doc(studentId)
      .set({
        status: 'submitted',
        reportFileName: reportFile.name,
        reportUrl: uploadResult.secure_url,
        reportPublicId: uploadResult.public_id,
        reportAssetId: uploadResult.asset_id,
        submittedByEmployerId: currentUser.uid,
        submittedByEmployerEmail: currentUser.email || '',
        storageProvider: 'cloudinary',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    fileInput.value = '';
    delete fileInput.dataset.selectedName;
    if (statusElement) {
      statusElement.textContent = 'No file selected';
    }

    await renderEmployerEvaluations();
  } catch (error) {
    console.error('Unable to submit evaluation report:', error);
    setEmployerEvaluationInlineError(card, error.message || 'Unable to submit the evaluation right now.');
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Evaluation';
  }
}

function bindEmployerEvaluationSubmitButtons() {
  document.querySelectorAll('[data-employer-evaluation-submit]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      const studentId = button.getAttribute('data-employer-evaluation-submit');
      const card = button.closest('[data-employer-evaluation-card]');

      if (!studentId || !card || button.disabled) {
        return;
      }

      await submitEmployerEvaluation(studentId, card);
    });
  });
}

async function fetchEmployerEvaluationData() {
  const currentUser = await getEmployerEvaluationCurrentUser();
  if (!currentUser) {
    return { assignedStudents: [], reports: [], hasUser: false };
  }

  const [studentsSnapshot, evaluationsSnapshot] = await Promise.all([
    firebase.firestore()
      .collection('users')
      .where('role', '==', 'student')
      .where('assignedEmployerId', '==', currentUser.uid)
      .get(),
    firebase.firestore()
      .collection(EMPLOYER_EVALUATION_COLLECTION)
      .where('employerId', '==', currentUser.uid)
      .get()
  ]);

  const assignedStudents = studentsSnapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data()
  }));

  assignedStudents.sort((left, right) => {
    const leftName = `${left.firstName || ''} ${left.lastName || ''}`.trim().toLowerCase();
    const rightName = `${right.firstName || ''} ${right.lastName || ''}`.trim().toLowerCase();
    return leftName.localeCompare(rightName);
  });

  const reports = evaluationsSnapshot.docs.map((doc) => ({
    studentId: doc.id,
    ...doc.data()
  }));

  reports.sort((left, right) => {
    const leftDate = left.requestedAt?.toDate ? left.requestedAt.toDate().getTime() : 0;
    const rightDate = right.requestedAt?.toDate ? right.requestedAt.toDate().getTime() : 0;
    return rightDate - leftDate;
  });

  return { assignedStudents, reports, hasUser: true };
}

async function renderEmployerEvaluations() {
  const list = document.getElementById('employerEvaluationList');
  if (!list) return;

  list.innerHTML = '<div class="applications-empty-state">Loading evaluation requests...</div>';

  try {
    const { assignedStudents, reports, hasUser } = await fetchEmployerEvaluationData();
    employerEvaluationAssignedStudents = assignedStudents;
    employerEvaluationPendingReports = reports.filter((report) => report.status === 'requested');

    if (!hasUser) {
      list.innerHTML = '<div class="applications-empty-state">Unable to determine the current employer.</div>';
      return;
    }

    updateEmployerEvaluationSummary(assignedStudents, reports);

    if (!employerEvaluationPendingReports.length) {
      list.innerHTML = '<div class="applications-empty-state">There are no evaluation requests waiting for submission right now.</div>';
      return;
    }

    list.innerHTML = employerEvaluationPendingReports.map(createEmployerEvaluationCard).join('');
    bindEmployerEvaluationFileInputs();
    bindEmployerEvaluationSubmitButtons();
  } catch (error) {
    console.error('Unable to load employer evaluations:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load evaluation requests right now.</div>';
  }
}

window.initializeEmployerEvaluationReportPages = function() {
  const list = document.getElementById('employerEvaluationList');
  if (!list) return;

  renderEmployerEvaluations();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeEmployerEvaluationReportPages();
});
