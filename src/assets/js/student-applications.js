const APPLICATION_COLLECTION = 'applications';
const FILE_SIZE_LIMIT = 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'doc'];
const CLOUDINARY_CLOUD_NAME = 'dufndkd8d';
const CLOUDINARY_UPLOAD_PRESET = 'coop_connect_file_upload';
const CLOUDINARY_RAW_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`;

function getCurrentFirebaseUser() {
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

function getApplicationDocRef(uid) {
  return firebase.firestore().collection(APPLICATION_COLLECTION).doc(uid);
}

function getFileExtension(fileName) {
  const nameParts = fileName.split('.');
  return nameParts.length > 1 ? nameParts.pop().toLowerCase() : '';
}

function validateApplicationFile(file) {
  if (!file) {
    return 'Please choose a file.';
  }

  const extension = getFileExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return 'Only PDF and DOC files can be uploaded.';
  }

  if (file.size > FILE_SIZE_LIMIT) {
    return 'Each document must be 1 MB or smaller.';
  }

  return '';
}

async function uploadFileToCloudinary(file, documentType, userId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('asset_folder', `coop-connect/applications/${userId}`);
  formData.append('tags', `coop-connect,application,${documentType},${userId}`);
  formData.append('context', `document_type=${documentType}|user_id=${userId}`);

  const response = await fetch(CLOUDINARY_RAW_UPLOAD_URL, {
    method: 'POST',
    body: formData
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Cloudinary upload failed.');
  }

  return payload;
}

function setUploadError(message) {
  const errorElement = document.getElementById('applicationUploadError');
  if (!errorElement) return;

  errorElement.textContent = message;
  errorElement.hidden = !message;
}

function setStudentApplicationActionButton({ text, disabled, onclickValue = '', visible = true }) {
  const actionButton = document.getElementById('studentApplicationAction');
  if (!actionButton) return;

  actionButton.textContent = text;
  actionButton.disabled = disabled;
  actionButton.hidden = !visible;

  if (onclickValue) {
    actionButton.setAttribute('onclick', onclickValue);
  } else {
    actionButton.removeAttribute('onclick');
  }
}

function updateApplicationStatusView(data) {
  const title = document.getElementById('studentApplicationTitle');
  const description = document.getElementById('studentApplicationDescription');
  const note = document.getElementById('studentApplicationNote');
  const badge = document.getElementById('studentApplicationBadge');
  const actionButton = document.getElementById('studentApplicationAction');
  const hasUploadedDocuments = Boolean(data?.resumeUrl || data?.coverLetterUrl);
  const coordinatorStatus = data?.coordinatorStatus || '';

  if (!title || !description || !note || !badge || !actionButton) {
    return;
  }

  if (coordinatorStatus === 'approved') {
    title.textContent = 'Approved';
    description.textContent = 'Your application has been approved by the coordinator.';
    note.textContent = 'You can move forward with the next co-op steps.';
    badge.className = 'status-badge completed';
    badge.textContent = 'Approved';
    setStudentApplicationActionButton({ text: 'Approved', disabled: true, visible: false });
    return;
  }

  if (coordinatorStatus === 'rejected') {
    title.textContent = 'Rejected';
    description.textContent = 'Your application was reviewed by the coordinator.';
    note.textContent = 'Please contact the coordinator if you need more information.';
    badge.className = 'status-badge rejected';
    badge.textContent = 'Rejected';
    setStudentApplicationActionButton({ text: 'Rejected', disabled: true, visible: false });
    return;
  }

  if (coordinatorStatus === 'in_process') {
    title.textContent = 'In Process';
    description.textContent = 'Your application is currently being reviewed by the coordinator.';
    note.textContent = 'No further action is needed from you right now.';
    badge.className = 'status-badge in-process';
    badge.textContent = 'In Process';
    setStudentApplicationActionButton({ text: 'In Process', disabled: true, visible: false });
    return;
  }

  if (data && data.status === 'pending' && hasUploadedDocuments) {
    title.textContent = 'Pending';
    description.textContent = 'Your resume and cover letter were submitted successfully.';
    note.textContent = 'Your application is pending review.';
    badge.className = 'status-badge pending';
    badge.textContent = 'Pending';
    setStudentApplicationActionButton({ text: 'Pending', disabled: true, visible: false });
    return;
  }

  title.textContent = 'Apply';
  description.textContent = 'New student users can start their co-op application here.';
  note.textContent = 'Start your first application';
  badge.className = 'status-badge pending';
  badge.textContent = 'New Student';
  setStudentApplicationActionButton({
    text: 'Start Application',
    disabled: false,
    onclickValue: "window.openDashboardSubscreen && window.openDashboardSubscreen('application-upload')",
    visible: true
  });
}

async function hydrateStudentApplicationCard() {
  const actionButton = document.getElementById('studentApplicationAction');
  if (!actionButton) return;

  try {
    const user = await getCurrentFirebaseUser();
    if (!user) return;

    const snapshot = await getApplicationDocRef(user.uid).get();
    updateApplicationStatusView(snapshot.exists ? snapshot.data() : null);
  } catch (error) {
    console.error('Unable to load application status:', error);
  }
}

function updateSubmitButtonState() {
  const resumeInput = document.getElementById('resumeInput');
  const coverLetterInput = document.getElementById('coverLetterInput');
  const submitButton = document.getElementById('submitApplicationBtn');

  if (!resumeInput || !coverLetterInput || !submitButton) return;

  const resumeSelected = Boolean(resumeInput.dataset.selectedName);
  const coverSelected = Boolean(coverLetterInput.dataset.selectedName);
  submitButton.disabled = !(resumeSelected && coverSelected);
}

function setSelectedFile(inputElement, statusElement, file) {
  inputElement.dataset.selectedName = file.name;
  statusElement.textContent = file.name;
}

function clearSelectedFile(inputElement, statusElement) {
  inputElement.value = '';
  delete inputElement.dataset.selectedName;
  statusElement.textContent = 'No file selected';
}

function initializeFileTriggerButtons() {
  const triggerButtons = document.querySelectorAll('[data-file-trigger]');

  triggerButtons.forEach((button) => {
    if (button.dataset.bound === 'true') return;

    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const inputId = button.getAttribute('data-file-trigger');
      const input = document.getElementById(inputId);
      if (input) {
        input.click();
      }
    });
  });
}

function bindUploadInput(inputId, statusId) {
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);

  if (!input || !status || input.dataset.bound === 'true') return;

  input.dataset.bound = 'true';
  input.addEventListener('change', () => {
    const [file] = input.files || [];

    if (!file) {
      clearSelectedFile(input, status);
      updateSubmitButtonState();
      return;
    }

    const validationMessage = validateApplicationFile(file);
    if (validationMessage) {
      clearSelectedFile(input, status);
      setUploadError(validationMessage);
      updateSubmitButtonState();
      return;
    }

    setUploadError('');
    setSelectedFile(input, status, file);
    updateSubmitButtonState();
  });
}

function initializeApplicationSubmit() {
  const submitButton = document.getElementById('submitApplicationBtn');
  if (!submitButton || submitButton.dataset.bound === 'true') return;

  submitButton.dataset.bound = 'true';
  submitButton.addEventListener('click', async () => {
    const resumeInput = document.getElementById('resumeInput');
    const coverLetterInput = document.getElementById('coverLetterInput');
    const resumeFile = resumeInput?.files?.[0];
    const coverLetterFile = coverLetterInput?.files?.[0];

    const resumeValidation = validateApplicationFile(resumeFile);
    const coverValidation = validateApplicationFile(coverLetterFile);

    setUploadError('');

    if (resumeValidation) {
      setUploadError(resumeValidation);
      return;
    }

    if (coverValidation) {
      setUploadError(coverValidation);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
      const user = await getCurrentFirebaseUser();
      if (!user) {
        throw new Error('You must be logged in to submit an application.');
      }

      const [resumeUpload, coverLetterUpload] = await Promise.all([
        uploadFileToCloudinary(resumeFile, 'resume', user.uid),
        uploadFileToCloudinary(coverLetterFile, 'cover-letter', user.uid)
      ]);

      await getApplicationDocRef(user.uid).set({
        userId: user.uid,
        status: 'pending',
        resumeFileName: resumeFile.name,
        resumeUrl: resumeUpload.secure_url,
        resumePublicId: resumeUpload.public_id,
        resumeAssetId: resumeUpload.asset_id,
        coverLetterFileName: coverLetterFile.name,
        coverLetterUrl: coverLetterUpload.secure_url,
        coverLetterPublicId: coverLetterUpload.public_id,
        coverLetterAssetId: coverLetterUpload.asset_id,
        storageProvider: 'cloudinary',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (window.openDashboardSubscreen) {
        window.openDashboardSubscreen('applications');
      }
    } catch (error) {
      console.error('Application upload failed:', error);
      setUploadError(error.message || 'Unable to upload your documents right now.');
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Application';
    }
  });
}

function initializeStudentApplicationUploadPage() {
  const submitButton = document.getElementById('submitApplicationBtn');
  if (!submitButton) return;

  initializeFileTriggerButtons();
  bindUploadInput('resumeInput', 'resumeFileStatus');
  bindUploadInput('coverLetterInput', 'coverLetterFileStatus');
  initializeApplicationSubmit();
  updateSubmitButtonState();
}

window.initializeStudentApplicationPages = function() {
  hydrateStudentApplicationCard();
  initializeStudentApplicationUploadPage();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeStudentApplicationPages();
});
