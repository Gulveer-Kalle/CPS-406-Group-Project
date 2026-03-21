function showCoordinatorAnnouncementStatus(message, type) {
  const statusElement = document.getElementById('coordinatorAnnouncementStatus');
  if (!statusElement) {
    return;
  }

  statusElement.hidden = false;
  statusElement.className = `announcement-compose-status ${type === 'success' ? 'success' : 'info'}`;
  statusElement.textContent = message;
}

async function getCoordinatorAnnouncementComposeContext() {
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

  const [coordinatorDoc, assignedStudentsSnapshot] = await Promise.all([
    firebase.firestore().collection('users').doc(authUser.uid).get(),
    firebase.firestore()
      .collection('users')
      .where('role', '==', 'student')
      .where('assignedCoordinatorId', '==', authUser.uid)
      .get()
  ]);

  const coordinatorData = coordinatorDoc.exists ? coordinatorDoc.data() : {};
  const coordinatorName = `${coordinatorData.firstName || ''} ${coordinatorData.lastName || ''}`.trim()
    || authUser.email
    || 'Coordinator';
  const students = assignedStudentsSnapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data()
  }));

  return {
    coordinatorId: authUser.uid,
    coordinatorName,
    coordinatorEmail: authUser.email || '',
    students
  };
}

function updateCoordinatorAnnouncementPreview() {
  const subjectInput = document.getElementById('coordinatorAnnouncementSubject');
  const messageInput = document.getElementById('coordinatorAnnouncementMessage');
  const previewCard = document.getElementById('coordinatorAnnouncementPreviewCard');
  const previewSubject = document.getElementById('coordinatorAnnouncementPreviewSubject');
  const previewBody = document.getElementById('coordinatorAnnouncementPreviewBody');

  if (!subjectInput || !messageInput || !previewCard || !previewSubject || !previewBody) {
    return;
  }

  previewCard.hidden = false;
  previewSubject.textContent = `Subject: ${subjectInput.value.trim() || '-'}`;
  previewBody.textContent = messageInput.value.trim() || 'Your message preview will appear here.';
}

window.initializeCoordinatorAnnouncementComposePage = function() {
  const form = document.getElementById('coordinatorAnnouncementComposeForm');
  if (!form || form.dataset.bound === 'true') {
    return;
  }

  form.dataset.bound = 'true';

  const previewButton = document.getElementById('coordinatorAnnouncementPreviewBtn');
  const cancelButton = document.getElementById('coordinatorAnnouncementCancelBtn');
  const subjectInput = document.getElementById('coordinatorAnnouncementSubject');
  const messageInput = document.getElementById('coordinatorAnnouncementMessage');

  if (previewButton) {
    previewButton.addEventListener('click', updateCoordinatorAnnouncementPreview);
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      const dashboardNav = document.querySelector('.nav-item[data-url="dashboard"]');
      if (dashboardNav) {
        dashboardNav.click();
      }
    });
  }

  [subjectInput, messageInput].forEach((input) => {
    if (!input) {
      return;
    }

    input.addEventListener('input', () => {
      const statusElement = document.getElementById('coordinatorAnnouncementStatus');
      if (statusElement) {
        statusElement.hidden = true;
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const subject = subjectInput?.value.trim() || '';
    const message = messageInput?.value.trim() || '';

    if (!subject || !message) {
      showCoordinatorAnnouncementStatus('Enter both a subject and a message before sending the email.', 'info');
      return;
    }

    try {
      const context = await getCoordinatorAnnouncementComposeContext();
      if (!context) {
        showCoordinatorAnnouncementStatus('You must be logged in to send an announcement.', 'info');
        return;
      }

      if (!context.students.length) {
        showCoordinatorAnnouncementStatus('No assigned students were found for this coordinator.', 'info');
        return;
      }

      if (window.pseudoMailStore?.sendCoordinatorAnnouncement) {
        window.pseudoMailStore.sendCoordinatorAnnouncement({
          coordinatorId: context.coordinatorId,
          coordinatorName: context.coordinatorName,
          coordinatorEmail: context.coordinatorEmail,
          subject,
          message,
          students: context.students
        });
      }
    } catch (error) {
      console.error('Unable to save coordinator announcement locally:', error);
      showCoordinatorAnnouncementStatus('Unable to send the announcement right now.', 'info');
      return;
    }

    updateCoordinatorAnnouncementPreview();
    showCoordinatorAnnouncementStatus('Email sent successfully.', 'success');
  });
};
