function showStudentCoordinatorContactStatus(message, type) {
  const statusElement = document.getElementById('studentCoordinatorContactStatus');
  if (!statusElement) {
    return;
  }

  statusElement.hidden = false;
  statusElement.className = `announcement-compose-status ${type === 'success' ? 'success' : 'info'}`;
  statusElement.textContent = message;
}

function updateStudentCoordinatorContactPreview() {
  const toElement = document.getElementById('studentCoordinatorContactTo');
  const subjectElement = document.getElementById('studentCoordinatorContactSubject');
  const messageElement = document.getElementById('studentCoordinatorContactMessage');
  const previewTo = document.getElementById('studentCoordinatorContactPreviewTo');
  const previewSubject = document.getElementById('studentCoordinatorContactPreviewSubject');
  const previewBody = document.getElementById('studentCoordinatorContactPreviewBody');

  if (!toElement || !subjectElement || !messageElement || !previewTo || !previewSubject || !previewBody) {
    return;
  }

  previewTo.textContent = `To: ${toElement.textContent.trim() || 'Assigned Coordinator'}`;
  previewSubject.textContent = `Subject: ${subjectElement.value.trim() || '-'}`;
  previewBody.textContent = messageElement.value.trim() || 'Your message preview will appear here.';
}

async function loadStudentCoordinatorContactTarget() {
  const toElement = document.getElementById('studentCoordinatorContactTo');
  const sendButton = document.getElementById('studentCoordinatorContactSendBtn');

  if (!toElement || !sendButton) {
    return false;
  }

  try {
    const authUser = await new Promise((resolve) => {
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

    if (!authUser) {
      toElement.textContent = 'No coordinator assigned';
      sendButton.disabled = true;
      return false;
    }

    const userDoc = await firebase.firestore().collection('users').doc(authUser.uid).get();
    if (!userDoc.exists) {
      toElement.textContent = 'No coordinator assigned';
      sendButton.disabled = true;
      return false;
    }

    const studentData = userDoc.data();
    if (window.assignStudentRelationshipsIfMissing) {
      const assignmentUpdate = await window.assignStudentRelationshipsIfMissing(authUser.uid, studentData);
      if (Object.keys(assignmentUpdate).length) {
        Object.assign(studentData, assignmentUpdate);
      }
    }

    const coordinatorName = studentData.assignedCoordinatorName || 'Assigned Coordinator';
    const coordinatorEmail = studentData.assignedCoordinatorEmail || 'No coordinator email available';
    toElement.textContent = `${coordinatorName} (${coordinatorEmail})`;
    sendButton.disabled = false;
    updateStudentCoordinatorContactPreview();
    return true;
  } catch (error) {
    console.error('Unable to load assigned coordinator for contact page:', error);
    toElement.textContent = 'No coordinator assigned';
    sendButton.disabled = true;
    return false;
  }
}

async function getStudentCoordinatorContactContext() {
  const authUser = await new Promise((resolve) => {
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

  if (!authUser) {
    return null;
  }

  const userDoc = await firebase.firestore().collection('users').doc(authUser.uid).get();
  if (!userDoc.exists) {
    return null;
  }

  const studentData = userDoc.data();
  if (window.assignStudentRelationshipsIfMissing) {
    const assignmentUpdate = await window.assignStudentRelationshipsIfMissing(authUser.uid, studentData);
    if (Object.keys(assignmentUpdate).length) {
      Object.assign(studentData, assignmentUpdate);
    }
  }

  return {
    studentId: authUser.uid,
    studentName: `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || authUser.email || 'Student',
    studentEmail: authUser.email || studentData.email || '',
    coordinatorId: studentData.assignedCoordinatorId || '',
    coordinatorName: studentData.assignedCoordinatorName || 'Assigned Coordinator',
    coordinatorEmail: studentData.assignedCoordinatorEmail || ''
  };
}

window.initializeStudentCoordinatorContactPage = function() {
  const form = document.getElementById('studentCoordinatorContactForm');
  if (!form || form.dataset.bound === 'true') {
    return;
  }

  form.dataset.bound = 'true';

  const previewButton = document.getElementById('studentCoordinatorContactPreviewBtn');
  const cancelButton = document.getElementById('studentCoordinatorContactCancelBtn');
  const subjectElement = document.getElementById('studentCoordinatorContactSubject');
  const messageElement = document.getElementById('studentCoordinatorContactMessage');

  loadStudentCoordinatorContactTarget();

  if (previewButton) {
    previewButton.addEventListener('click', updateStudentCoordinatorContactPreview);
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      const dashboardNav = document.querySelector('.nav-item[data-url="dashboard"]');
      if (dashboardNav) {
        dashboardNav.click();
      }
    });
  }

  [subjectElement, messageElement].forEach((element) => {
    if (!element) {
      return;
    }

    element.addEventListener('input', () => {
      const statusElement = document.getElementById('studentCoordinatorContactStatus');
      if (statusElement) {
        statusElement.hidden = true;
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const hasCoordinator = await loadStudentCoordinatorContactTarget();
    if (!hasCoordinator) {
      showStudentCoordinatorContactStatus('No assigned coordinator is available for contact right now.', 'info');
      return;
    }

    const subject = subjectElement?.value.trim() || '';
    const message = messageElement?.value.trim() || '';

    if (!subject || !message) {
      showStudentCoordinatorContactStatus('Enter both a subject and a message before sending the email.', 'info');
      return;
    }

    try {
      const context = await getStudentCoordinatorContactContext();
      if (!context?.coordinatorId) {
        showStudentCoordinatorContactStatus('No assigned coordinator is available for contact right now.', 'info');
        return;
      }

      if (window.pseudoMailStore?.sendStudentCoordinatorMessage) {
        window.pseudoMailStore.sendStudentCoordinatorMessage({
          studentId: context.studentId,
          studentName: context.studentName,
          studentEmail: context.studentEmail,
          coordinatorId: context.coordinatorId,
          coordinatorName: context.coordinatorName,
          coordinatorEmail: context.coordinatorEmail,
          subject,
          message
        });
      }
    } catch (error) {
      console.error('Unable to save student coordinator message locally:', error);
      showStudentCoordinatorContactStatus('Unable to send the email right now.', 'info');
      return;
    }

    updateStudentCoordinatorContactPreview();
    showStudentCoordinatorContactStatus('Email sent successfully.', 'success');
  });
};
