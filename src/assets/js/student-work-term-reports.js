const WORK_TERM_REPORT_COLLECTION = 'workTermReports';
const WORK_TERM_REPORT_SETTINGS_COLLECTION = 'settings';
const WORK_TERM_REPORT_SETTINGS_DOC = 'workTermReports';
const WORK_TERM_REPORT_FILE_SIZE_LIMIT = 5 * 1024 * 1024;
const WORK_TERM_REPORT_CLOUD_NAME = 'dufndkd8d';
const WORK_TERM_REPORT_UPLOAD_PRESET = 'coop_connect_file_upload';
const WORK_TERM_REPORT_RAW_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${WORK_TERM_REPORT_CLOUD_NAME}/raw/upload`;
let studentWorkTermLatestReport = null;
let studentWorkTermDueDateValue = '';

function getCurrentStudentReportUser() {
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

function getWorkTermReportMonthYear(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function validateWorkTermReportFile(file) {
  if (!file) {
    return 'Please choose a PDF report to upload.';
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (extension !== 'pdf') {
    return 'Only PDF files can be uploaded for work term reports.';
  }

  if (file.size > WORK_TERM_REPORT_FILE_SIZE_LIMIT) {
    return 'Work term reports must be 5 MB or smaller.';
  }

  return '';
}

function setStudentReportUploadError(message) {
  const errorElement = document.getElementById('studentReportUploadError');
  if (!errorElement) return;

  errorElement.textContent = message;
  errorElement.hidden = !message;
}

function setStudentReportSubmissionRuleMessage(message) {
  const messageElement = document.getElementById('studentReportSubmissionRuleMessage');
  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.hidden = !message;
}

function parseStudentWorkTermDueDate(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return null;
  }

  const match = normalizedValue.match(/^(\d{2}) ([A-Z]{3}) (\d{4})$/);
  if (!match) {
    return null;
  }

  const monthMap = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11
  };

  const [, dayText, monthText, yearText] = match;
  const monthIndex = monthMap[monthText];
  if (monthIndex === undefined) {
    return null;
  }

  const parsedDate = new Date(Number(yearText), monthIndex, Number(dayText), 23, 59, 59, 999);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getStudentReportUploadedDate(report) {
  if (!report?.uploadedAt) {
    return null;
  }

  if (report.uploadedAt instanceof Date) {
    return report.uploadedAt;
  }

  if (report.uploadedAt?.toDate) {
    return report.uploadedAt.toDate();
  }

  return null;
}

function getStudentReportSubmissionRuleState() {
  if (!studentWorkTermLatestReport) {
    return {
      canSubmit: true,
      message: 'You can submit your first work term report.'
    };
  }

  const latestUploadedDate = getStudentReportUploadedDate(studentWorkTermLatestReport);
  const parsedDueDate = parseStudentWorkTermDueDate(studentWorkTermDueDateValue);

  if (!latestUploadedDate || !parsedDueDate) {
    return {
      canSubmit: false,
      message: 'A report is already on file. You can submit again after the coordinator sets a newer due date.'
    };
  }

  if (parsedDueDate.getTime() > latestUploadedDate.getTime()) {
    return {
      canSubmit: true,
      message: 'A newer due date is available, so you can submit another report.'
    };
  }

  return {
    canSubmit: false,
    message: 'Your latest report already covers the current due date. You can submit again only after the due date is updated to a later date.'
  };
}

function updateStudentReportSubmitButtonState() {
  const companyInput = document.getElementById('studentReportCompanyInput');
  const jobTitleInput = document.getElementById('studentReportJobTitleInput');
  const fileInput = document.getElementById('studentReportFileInput');
  const submitButton = document.getElementById('studentReportSubmitBtn');

  if (!companyInput || !jobTitleInput || !fileInput || !submitButton) return;

  const submissionRule = getStudentReportSubmissionRuleState();
  const hasCompany = companyInput.value.trim().length > 0;
  const hasJobTitle = jobTitleInput.value.trim().length > 0;
  const hasFile = Boolean(fileInput.dataset.selectedName);

  setStudentReportSubmissionRuleMessage(submissionRule.message);
  submitButton.disabled = !(submissionRule.canSubmit && hasCompany && hasJobTitle && hasFile);
}

async function uploadWorkTermReportToCloudinary(file, userId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', WORK_TERM_REPORT_UPLOAD_PRESET);
  formData.append('asset_folder', `coop-connect/work-term-reports/${userId}`);
  formData.append('tags', `coop-connect,work-term-report,${userId}`);
  formData.append('context', `document_type=work_term_report|user_id=${userId}`);

  const response = await fetch(WORK_TERM_REPORT_RAW_UPLOAD_URL, {
    method: 'POST',
    body: formData
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Cloudinary upload failed.');
  }

  return payload;
}

function bindStudentReportFileTrigger() {
  const triggerButton = document.querySelector('[data-file-trigger="studentReportFileInput"]');
  const fileInput = document.getElementById('studentReportFileInput');

  if (!triggerButton || !fileInput || triggerButton.dataset.bound === 'true') return;

  triggerButton.dataset.bound = 'true';
  triggerButton.addEventListener('click', () => {
    fileInput.click();
  });
}

function bindStudentReportFormInputs() {
  const companyInput = document.getElementById('studentReportCompanyInput');
  const jobTitleInput = document.getElementById('studentReportJobTitleInput');
  const fileInput = document.getElementById('studentReportFileInput');
  const fileStatus = document.getElementById('studentReportFileStatus');

  if (companyInput && companyInput.dataset.bound !== 'true') {
    companyInput.dataset.bound = 'true';
    companyInput.addEventListener('input', updateStudentReportSubmitButtonState);
  }

  if (jobTitleInput && jobTitleInput.dataset.bound !== 'true') {
    jobTitleInput.dataset.bound = 'true';
    jobTitleInput.addEventListener('input', updateStudentReportSubmitButtonState);
  }

  if (fileInput && fileStatus && fileInput.dataset.bound !== 'true') {
    fileInput.dataset.bound = 'true';
    fileInput.addEventListener('change', () => {
      const [file] = fileInput.files || [];

      if (!file) {
        delete fileInput.dataset.selectedName;
        fileStatus.textContent = 'No file selected';
        updateStudentReportSubmitButtonState();
        return;
      }

      const validationMessage = validateWorkTermReportFile(file);
      if (validationMessage) {
        fileInput.value = '';
        delete fileInput.dataset.selectedName;
        fileStatus.textContent = 'No file selected';
        setStudentReportUploadError(validationMessage);
        updateStudentReportSubmitButtonState();
        return;
      }

      setStudentReportUploadError('');
      fileInput.dataset.selectedName = file.name;
      fileStatus.textContent = file.name;
      updateStudentReportSubmitButtonState();
    });
  }
}

function createStudentWorkTermReportItem(report) {
  return `
    <div class="term-item">
      <div class="term-info">
        <span class="term-season">${report.uploadMonthYear || 'Unknown upload date'}</span>
        <span class="term-employer">${report.companyName || 'Unknown company'}</span>
        <span class="term-grade">${report.jobTitle || 'Unknown position'}</span>
      </div>
      <div class="term-status">
        <a class="quick-view-btn" href="${report.reportUrl}" target="_blank" rel="noopener noreferrer">View</a>
      </div>
    </div>
  `;
}

async function renderStudentWorkTermReports() {
  const reportList = document.getElementById('studentReportList');
  const reportCount = document.getElementById('studentReportCount');
  const latestUpload = document.getElementById('studentReportLatestUpload');

  if (!reportList || !reportCount || !latestUpload) return;

  reportList.innerHTML = '<div class="applications-empty-state">Loading reports...</div>';

  try {
    const user = await getCurrentStudentReportUser();
    if (!user) return;

    const snapshot = await firebase.firestore()
      .collection(WORK_TERM_REPORT_COLLECTION)
      .where('userId', '==', user.uid)
      .get();

    const reports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    reports.sort((left, right) => {
      const leftDate = left.uploadedAt?.toDate ? left.uploadedAt.toDate().getTime() : 0;
      const rightDate = right.uploadedAt?.toDate ? right.uploadedAt.toDate().getTime() : 0;
      return rightDate - leftDate;
    });

    studentWorkTermLatestReport = reports[0] || null;

    reportCount.textContent = String(reports.length);
    latestUpload.textContent = reports.length ? reports[0].uploadMonthYear || 'Latest upload' : 'No uploads yet';

    if (!reports.length) {
      reportList.innerHTML = '<div class="applications-empty-state">No work term reports uploaded yet.</div>';
      return;
    }

    reportList.innerHTML = reports.map(createStudentWorkTermReportItem).join('');
    updateStudentReportSubmitButtonState();
  } catch (error) {
    console.error('Unable to load work term reports:', error);
    studentWorkTermLatestReport = null;
    reportList.innerHTML = '<div class="applications-empty-state">Unable to load work term reports right now.</div>';
  }
}

async function renderStudentWorkTermReportDueDate() {
  const dueDateDisplay = document.getElementById('studentReportDueDateDisplay');
  if (!dueDateDisplay) return;

  try {
    const settingsDoc = await firebase.firestore()
      .collection(WORK_TERM_REPORT_SETTINGS_COLLECTION)
      .doc(WORK_TERM_REPORT_SETTINGS_DOC)
      .get();

    studentWorkTermDueDateValue = settingsDoc.exists ? settingsDoc.data().dueDateDisplay || '' : '';
    dueDateDisplay.textContent = settingsDoc.exists
      ? settingsDoc.data().dueDateDisplay || 'No Due Date'
      : 'No Due Date';
    updateStudentReportSubmitButtonState();
  } catch (error) {
    console.error('Unable to load work term report due date:', error);
    studentWorkTermDueDateValue = '';
    dueDateDisplay.textContent = 'No Due Date';
  }
}

function bindStudentWorkTermReportSubmit() {
  const submitButton = document.getElementById('studentReportSubmitBtn');
  if (!submitButton || submitButton.dataset.bound === 'true') return;

  submitButton.dataset.bound = 'true';
  submitButton.addEventListener('click', async () => {
    const companyInput = document.getElementById('studentReportCompanyInput');
    const jobTitleInput = document.getElementById('studentReportJobTitleInput');
    const fileInput = document.getElementById('studentReportFileInput');
    const fileStatus = document.getElementById('studentReportFileStatus');
    const reportFile = fileInput?.files?.[0];
    const companyName = companyInput?.value.trim() || '';
    const jobTitle = jobTitleInput?.value.trim() || '';

    setStudentReportUploadError('');

    if (!companyName) {
      setStudentReportUploadError('Please enter the company name.');
      return;
    }

    if (!jobTitle) {
      setStudentReportUploadError('Please enter the job title.');
      return;
    }

    const validationMessage = validateWorkTermReportFile(reportFile);
    if (validationMessage) {
      setStudentReportUploadError(validationMessage);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
      const user = await getCurrentStudentReportUser();
      if (!user) {
        throw new Error('You must be logged in to submit a report.');
      }

      const submissionRule = getStudentReportSubmissionRuleState();
      if (!submissionRule.canSubmit) {
        throw new Error(submissionRule.message);
      }

      const uploadDate = new Date();
      const uploadMonthYear = getWorkTermReportMonthYear(uploadDate);
      const uploadResult = await uploadWorkTermReportToCloudinary(reportFile, user.uid);

      await firebase.firestore().collection(WORK_TERM_REPORT_COLLECTION).add({
        userId: user.uid,
        companyName: companyName,
        jobTitle: jobTitle,
        reportFileName: reportFile.name,
        reportUrl: uploadResult.secure_url,
        reportPublicId: uploadResult.public_id,
        reportAssetId: uploadResult.asset_id,
        uploadMonthYear: uploadMonthYear,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      companyInput.value = '';
      jobTitleInput.value = '';
      fileInput.value = '';
      delete fileInput.dataset.selectedName;
      fileStatus.textContent = 'No file selected';

      await renderStudentWorkTermReports();
      updateStudentReportSubmitButtonState();
      submitButton.textContent = 'Submit Report';
    } catch (error) {
      console.error('Unable to upload work term report:', error);
      setStudentReportUploadError(error.message || 'Unable to upload the work term report right now.');
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Report';
      return;
    }

    submitButton.disabled = true;
  });
}

window.initializeStudentWorkTermReportPages = function() {
  const reportList = document.getElementById('studentReportList');
  if (!reportList) return;

  bindStudentReportFileTrigger();
  bindStudentReportFormInputs();
  bindStudentWorkTermReportSubmit();
  updateStudentReportSubmitButtonState();
  renderStudentWorkTermReportDueDate();
  renderStudentWorkTermReports();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeStudentWorkTermReportPages();
});
