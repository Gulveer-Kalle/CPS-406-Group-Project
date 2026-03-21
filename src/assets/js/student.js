// Student Dashboard JavaScript

const STUDENT_WORK_TERM_REPORT_COLLECTION = 'workTermReports';
const STUDENT_ANNOUNCEMENT_COLLECTION = 'studentAnnouncements';
const STUDENT_REQUIRED_WORK_TERMS = 4;
const STUDENT_WORK_TERM_SEQUENCE = ['Winter', 'Summer', 'Fall'];

function getCurrentStudentDashboardUser() {
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

function getStudentDashboardTimestampDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (value?.toDate) {
    return value.toDate();
  }

  return null;
}

function formatStudentDashboardRelativeTime(value) {
  const date = getStudentDashboardTimestampDate(value);
  if (!date) {
    return 'Recently';
  }

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return 'Just now';
  }

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.floor(diffMs / minute));
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.floor(diffMs / hour));
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (diffMs < 7 * day) {
    const days = Math.max(1, Math.floor(diffMs / day));
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function escapeStudentDashboardHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStudentWorkTermSeason(date) {
  const month = date.getMonth();
  if (month <= 3) {
    return 'Winter';
  }

  if (month <= 7) {
    return 'Summer';
  }

  return 'Fall';
}

function getStudentWorkTermLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Unknown Term';
  }

  return `${getStudentWorkTermSeason(date)} ${date.getFullYear()}`;
}

function advanceStudentWorkTerm(termLabel, stepCount = 1) {
  const match = String(termLabel || '').match(/^(Winter|Summer|Fall) (\d{4})$/);
  if (!match) {
    return getStudentWorkTermLabel(new Date());
  }

  const currentSeason = match[1];
  let currentYear = Number(match[2]);
  let currentIndex = STUDENT_WORK_TERM_SEQUENCE.indexOf(currentSeason);

  if (currentIndex < 0) {
    return getStudentWorkTermLabel(new Date());
  }

  for (let step = 0; step < stepCount; step += 1) {
    currentIndex += 1;
    if (currentIndex >= STUDENT_WORK_TERM_SEQUENCE.length) {
      currentIndex = 0;
      currentYear += 1;
    }
  }

  return `${STUDENT_WORK_TERM_SEQUENCE[currentIndex]} ${currentYear}`;
}

function createStudentAnnouncementItem(message) {
  return `
    <div class="term-item student-announcement-item${message.read ? ' is-read' : ''}" data-announcement-id="${escapeStudentDashboardHtml(message.id)}">
      <div class="term-info">
        <span class="term-season">${escapeStudentDashboardHtml(message.subject || 'Coordinator Message')}</span>
        <span class="term-employer">From ${escapeStudentDashboardHtml(message.coordinatorName || 'Your Coordinator')} - ${escapeStudentDashboardHtml(formatStudentDashboardRelativeTime(message.createdAt))}</span>
        <span class="dashboard-message-body">${escapeStudentDashboardHtml(message.message || '')}</span>
      </div>
      <div class="term-status">
        <span class="status-badge ${message.read ? 'neutral' : 'in-process'}">${message.read ? 'Viewed' : 'New'}</span>
        <button class="quick-view-btn student-message-delete-btn" type="button" data-delete-student-announcement="${escapeStudentDashboardHtml(message.id)}">Delete</button>
      </div>
    </div>
  `;
}

function createStudentDashboardWorkTermItem(report) {
  const gradeValue = report.assignedGrade || report.coordinatorGradeDraft;
  const gradeLabel = gradeValue ? `Grade: ${gradeValue}` : (report.jobTitle || 'Grade pending');
  const viewControl = report.reportUrl
    ? `<a class="quick-view-btn" href="${escapeStudentDashboardHtml(report.reportUrl)}" target="_blank" rel="noopener noreferrer">View</a>`
    : '<span class="application-card-note">No file</span>';

  return `
    <div class="term-item">
      <div class="term-info">
        <span class="term-season">${escapeStudentDashboardHtml(report.workTermLabel || 'Unknown Term')}</span>
        <span class="term-employer">${escapeStudentDashboardHtml(report.companyName || 'Unknown company')}</span>
        <span class="term-grade">${escapeStudentDashboardHtml(gradeLabel)}</span>
      </div>
      <div class="term-status">
        <span class="status-badge completed">Report Submitted</span>
        ${viewControl}
      </div>
    </div>
  `;
}

async function markStudentAnnouncementAsRead(announcementId) {
  if (!announcementId) {
    return;
  }

  try {
    if (window.pseudoMailStore?.markStudentAnnouncementRead) {
      window.pseudoMailStore.markStudentAnnouncementRead(announcementId);
    }
  } catch (error) {
    console.error('Unable to mark student announcement as read:', error);
  }
}

function bindStudentAnnouncementDeleteButtons() {
  document.querySelectorAll('[data-delete-student-announcement]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const announcementId = button.getAttribute('data-delete-student-announcement');
      if (!announcementId || !window.pseudoMailStore?.deleteStudentAnnouncement) {
        return;
      }

      window.pseudoMailStore.deleteStudentAnnouncement(announcementId);
      loadStudentDashboardAnnouncements();
    });
  });
}

function initializeStudentAnnouncementInteractions() {
  const list = document.getElementById('studentDashboardAnnouncementsList');
  if (!list || list.dataset.announcementBound === 'true') {
    return;
  }

  list.dataset.announcementBound = 'true';
  list.addEventListener('click', async (event) => {
    const item = event.target.closest('.student-announcement-item');
    if (!item || !list.contains(item) || item.classList.contains('is-read')) {
      return;
    }

    item.classList.add('is-read');
    const badge = item.querySelector('.status-badge');
    if (badge) {
      badge.classList.remove('in-process');
      badge.classList.add('neutral');
      badge.textContent = 'Viewed';
    }

    await markStudentAnnouncementAsRead(item.dataset.announcementId);
  });
}

async function loadStudentDashboardAnnouncements() {
  const list = document.getElementById('studentDashboardAnnouncementsList');
  if (!list) {
    return;
  }

  list.innerHTML = '<div class="applications-empty-state">Loading coordinator messages...</div>';

  try {
    const user = await getCurrentStudentDashboardUser();
    if (!user) {
      list.innerHTML = '<div class="applications-empty-state">Unable to load coordinator messages.</div>';
      return;
    }

    const announcements = window.pseudoMailStore?.getStudentAnnouncements
      ? window.pseudoMailStore.getStudentAnnouncements(user.uid)
      : [];

    if (!announcements.length) {
      list.innerHTML = '<div class="applications-empty-state">No coordinator messages yet.</div>';
      return;
    }

    list.innerHTML = announcements.slice(0, 1).map(createStudentAnnouncementItem).join('');
    bindStudentAnnouncementDeleteButtons();
  } catch (error) {
    console.error('Unable to load student coordinator messages:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load coordinator messages right now.</div>';
  }
}

async function loadStudentAssignments() {
  try {
    const user = await getCurrentStudentDashboardUser();
    if (!user) {
      return null;
    }

    const userRef = firebase.firestore().collection('users').doc(user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    if (window.assignStudentRelationshipsIfMissing) {
      const assignmentUpdate = await window.assignStudentRelationshipsIfMissing(user.uid, userData);
      if (Object.keys(assignmentUpdate).length) {
        return { ...userData, ...assignmentUpdate };
      }
    }

    return userData;
  } catch (error) {
    console.error('Unable to load student assignments:', error);
    return null;
  }
}

async function loadStudentDashboardOverview() {
  const currentWorkTermElement = document.getElementById('studentDashboardCurrentWorkTerm');
  const remainingElement = document.getElementById('studentDashboardWorkTermsRemaining');
  const reportCountElement = document.getElementById('studentDashboardReportCount');
  const gradeElement = document.getElementById('studentDashboardGradeValue');
  const recentList = document.getElementById('studentDashboardRecentWorkTermsList');

  if (!currentWorkTermElement || !remainingElement || !reportCountElement || !gradeElement || !recentList) {
    return;
  }

  recentList.innerHTML = '<div class="applications-empty-state">Loading work terms...</div>';

  try {
    const user = await getCurrentStudentDashboardUser();
    if (!user) {
      return;
    }

    const snapshot = await firebase.firestore()
      .collection(STUDENT_WORK_TERM_REPORT_COLLECTION)
      .where('userId', '==', user.uid)
      .get();

    const reports = snapshot.docs.map((doc) => {
      const data = doc.data();
      const uploadedDate = getStudentDashboardTimestampDate(data.uploadedAt);

      return {
        id: doc.id,
        ...data,
        uploadedDate,
        workTermLabel: uploadedDate ? getStudentWorkTermLabel(uploadedDate) : 'Unknown Term'
      };
    });

    reports.sort((left, right) => {
      const leftTime = left.uploadedDate?.getTime() || 0;
      const rightTime = right.uploadedDate?.getTime() || 0;
      return rightTime - leftTime;
    });

    const latestReport = reports[0] || null;
    const currentWorkTerm = latestReport?.workTermLabel
      ? advanceStudentWorkTerm(latestReport.workTermLabel, 2)
      : getStudentWorkTermLabel(new Date());
    const latestGrade = reports.find((report) => report.assignedGrade || report.coordinatorGradeDraft);
    const workTermsRemaining = Math.max(0, STUDENT_REQUIRED_WORK_TERMS - reports.length);

    currentWorkTermElement.textContent = currentWorkTerm;
    remainingElement.textContent = String(workTermsRemaining);
    reportCountElement.textContent = String(reports.length);
    gradeElement.textContent = latestGrade?.assignedGrade || latestGrade?.coordinatorGradeDraft || '-';

    if (!reports.length) {
      recentList.innerHTML = '<div class="applications-empty-state">No work term reports submitted yet.</div>';
      return;
    }

    recentList.innerHTML = reports.slice(0, 4).map(createStudentDashboardWorkTermItem).join('');
  } catch (error) {
    console.error('Unable to load student dashboard overview:', error);
    currentWorkTermElement.textContent = '-';
    remainingElement.textContent = '-';
    reportCountElement.textContent = '0';
    gradeElement.textContent = '-';
    recentList.innerHTML = '<div class="applications-empty-state">Unable to load work terms right now.</div>';
  }
}

window.handleStudentContactCoordinator = function() {
  if (window.openDashboardSubscreen) {
    window.openDashboardSubscreen('contact-coordinator');
    return;
  }

  window.alert('Unable to open the coordinator contact page right now.');
};

document.addEventListener('DOMContentLoaded', function() {
  console.log('Student dashboard loaded');

  const userRole = localStorage.getItem('userRole');
  if (!userRole || userRole !== 'student') {
    console.warn('Invalid role for student dashboard:', userRole);
    window.location.href = '../pages/login.html';
    return;
  }

  let studentAssignmentData = null;

  loadStudentAssignments().then((assignmentData) => {
    studentAssignmentData = assignmentData;
  });

  const actionBtns = document.querySelectorAll('.action-btn');
  actionBtns.forEach((btn) => {
    if (btn.dataset.bound === 'true') {
      return;
    }

    btn.dataset.bound = 'true';
    btn.addEventListener('click', function() {
      const actionText = this.querySelector('.action-text')?.textContent;

      switch (actionText) {
        case 'Contact Coordinator':
          if (window.handleStudentContactCoordinator) {
            window.handleStudentContactCoordinator();
          }
          break;
        case 'Update Profile':
          {
            const profileNav = document.querySelector('[data-url="profile"], [data-section="profile"]');
            if (profileNav) profileNav.click();
          }
          break;
      }
    });
  });

  loadStudentDashboardOverview();
  loadStudentDashboardAnnouncements();
  initializeStudentAnnouncementInteractions();

  const coordBtn = document.getElementById('viewCoordinatorBtn');
  if (coordBtn) {
    coordBtn.addEventListener('click', function() {
      const coordinatorName = studentAssignmentData?.assignedCoordinatorName || 'No coordinator assigned';
      const coordinatorEmail = studentAssignmentData?.assignedCoordinatorEmail || 'No coordinator email available';
      alert(`My Coordinator\n\nName: ${coordinatorName}\nEmail: ${coordinatorEmail}`);
    });
  }

  const empBtn = document.getElementById('viewEmployerBtn');
  if (empBtn) {
    empBtn.addEventListener('click', function() {
      const employerName = studentAssignmentData?.assignedEmployerName || 'No employer assigned';
      const employerEmail = studentAssignmentData?.assignedEmployerEmail || 'No employer email available';
      alert(`My Employer\n\nName: ${employerName}\nEmail: ${employerEmail}`);
    });
  }
});
