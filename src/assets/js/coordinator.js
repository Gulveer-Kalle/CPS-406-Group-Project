// Coordinator Dashboard JavaScript

const COORDINATOR_ANNOUNCEMENT_COLLECTION = 'coordinatorAnnouncements';
const STUDENT_ANNOUNCEMENT_COLLECTION = 'studentAnnouncements';

function getCoordinatorCurrentUser() {
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

function getCoordinatorLatestReportDateValue(report) {
  return report?.uploadedAt?.toDate ? report.uploadedAt.toDate().getTime() : 0;
}

function getCoordinatorTimestampDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value?.toDate) {
    return value.toDate();
  }

  return null;
}

function formatCoordinatorRelativeTime(value) {
  const date = getCoordinatorTimestampDate(value);
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

function escapeCoordinatorDashboardHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCoordinatorDashboardApplicationStatus(status) {
  switch (status) {
    case 'approved':
      return { label: 'Approved', className: 'completed' };
    case 'rejected':
      return { label: 'Rejected', className: 'rejected' };
    case 'in_process':
      return { label: 'In Process', className: 'in-process' };
    case 'pending':
    default:
      return { label: 'Pending Review', className: 'pending' };
  }
}

function createCoordinatorActivityItem(activity) {
  return `
    <div class="term-item">
      <div class="term-info">
        <span class="term-season">${escapeCoordinatorDashboardHtml(activity.title)}</span>
        <span class="term-employer">${escapeCoordinatorDashboardHtml(activity.description)}</span>
        <span class="term-grade">${escapeCoordinatorDashboardHtml(activity.timeLabel)}</span>
      </div>
      <div class="term-status">
        <span class="status-badge ${escapeCoordinatorDashboardHtml(activity.statusClassName)}">${escapeCoordinatorDashboardHtml(activity.statusLabel)}</span>
      </div>
    </div>
  `;
}

function createCoordinatorInboxMessageItem(message) {
  return `
    <div class="term-item" data-coordinator-inbox-message-id="${escapeCoordinatorDashboardHtml(message.id)}">
      <div class="term-info">
        <span class="term-season">${escapeCoordinatorDashboardHtml(message.subject || 'Student Message')}</span>
        <span class="term-employer">From ${escapeCoordinatorDashboardHtml(message.studentName || 'A student')} - ${escapeCoordinatorDashboardHtml(message.studentEmail || 'No email available')}</span>
        <span class="dashboard-message-body">${escapeCoordinatorDashboardHtml(message.message || '')}</span>
      </div>
      <div class="term-status">
        <span class="status-badge in-process">New</span>
        <button class="quick-view-btn coordinator-message-delete-btn" type="button" data-delete-coordinator-message="${escapeCoordinatorDashboardHtml(message.id)}">Delete</button>
      </div>
    </div>
  `;
}

function bindCoordinatorInboxDeleteButtons() {
  document.querySelectorAll('[data-delete-coordinator-message]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const messageId = button.getAttribute('data-delete-coordinator-message');
      if (!messageId || !window.pseudoMailStore?.deleteCoordinatorInboxMessage) {
        return;
      }

      window.pseudoMailStore.deleteCoordinatorInboxMessage(messageId);
      loadCoordinatorStudentMessages();
    });
  });
}

async function loadCoordinatorStudentMessages() {
  const list = document.getElementById('coordinatorDashboardStudentMessagesList');
  if (!list) {
    return;
  }

  try {
    const currentUser = await getCoordinatorCurrentUser();
    if (!currentUser) {
      list.innerHTML = '<div class="applications-empty-state">Unable to load student messages.</div>';
      return;
    }

    const messages = window.pseudoMailStore?.getCoordinatorInboxMessages
      ? window.pseudoMailStore.getCoordinatorInboxMessages(currentUser.uid)
      : [];

    if (!messages.length) {
      list.innerHTML = '<div class="applications-empty-state">No student messages yet.</div>';
      return;
    }

    list.innerHTML = messages.map(createCoordinatorInboxMessageItem).join('');
    bindCoordinatorInboxDeleteButtons();
  } catch (error) {
    console.error('Unable to load coordinator student messages:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load student messages right now.</div>';
  }
}

async function loadCoordinatorRecentActivity() {
  const activityList = document.getElementById('coordinatorDashboardRecentActivityList');
  if (!activityList) {
    return;
  }

  activityList.innerHTML = '<div class="applications-empty-state">Loading recent activity...</div>';

  try {
    const currentUser = await getCoordinatorCurrentUser();
    if (!currentUser) {
      return;
    }

    const [assignedStudentsSnapshot, applicationsSnapshot, reportsSnapshot, evaluationsSnapshot, announcementsSnapshotResult] = await Promise.allSettled([
      firebase.firestore()
        .collection('users')
        .where('role', '==', 'student')
        .where('assignedCoordinatorId', '==', currentUser.uid)
        .get(),
      firebase.firestore().collection('applications').get(),
      firebase.firestore().collection('workTermReports').get(),
      firebase.firestore().collection('evaluationReports').get(),
      firebase.firestore()
        .collection(COORDINATOR_ANNOUNCEMENT_COLLECTION)
        .where('coordinatorId', '==', currentUser.uid)
        .get()
    ]);

    if (
      assignedStudentsSnapshot.status !== 'fulfilled' ||
      applicationsSnapshot.status !== 'fulfilled' ||
      reportsSnapshot.status !== 'fulfilled' ||
      evaluationsSnapshot.status !== 'fulfilled'
    ) {
      throw new Error('Unable to load coordinator dashboard activity data.');
    }

    const assignedStudents = assignedStudentsSnapshot.value.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data()
    }));
    const assignedStudentsById = new Map(
      assignedStudents.map((student) => [student.uid, student])
    );
    const assignedStudentIds = new Set(assignedStudents.map((student) => student.uid));

    const activities = [];

    assignedStudents.forEach((student) => {
      if (!student.assignmentUpdatedAt) {
        return;
      }

      activities.push({
        sortDate: getCoordinatorTimestampDate(student.assignmentUpdatedAt),
        title: 'Student Assigned',
        description: `${`${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email || 'A student'} is assigned to your coordinator roster.`,
        timeLabel: formatCoordinatorRelativeTime(student.assignmentUpdatedAt),
        statusLabel: 'Assigned',
        statusClassName: 'neutral'
      });
    });

    applicationsSnapshot.value.docs.forEach((doc) => {
      if (!assignedStudentIds.has(doc.id)) {
        return;
      }

      const application = doc.data();
      const student = assignedStudentsById.get(doc.id);
      const submittedAt = application.submittedAt || application.updatedAt;

      if (!submittedAt) {
        return;
      }

      const statusPresentation = getCoordinatorDashboardApplicationStatus(
        application.coordinatorStatus || application.status || 'pending'
      );
      const studentName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || student?.email || 'A student';

      activities.push({
        sortDate: getCoordinatorTimestampDate(submittedAt),
        title: 'Application Submitted',
        description: `${studentName} submitted co-op application documents.`,
        timeLabel: formatCoordinatorRelativeTime(submittedAt),
        statusLabel: statusPresentation.label,
        statusClassName: statusPresentation.className
      });
    });

    reportsSnapshot.value.docs.forEach((doc) => {
      const report = doc.data();
      if (!assignedStudentIds.has(report.userId) || !report.reportUrl || !report.uploadedAt) {
        return;
      }

      const student = assignedStudentsById.get(report.userId);
      const studentName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || student?.email || 'A student';

      activities.push({
        sortDate: getCoordinatorTimestampDate(report.uploadedAt),
        title: 'Work-term Report Submitted',
        description: `${studentName} uploaded a work-term report${report.companyName ? ` for ${report.companyName}` : ''}.`,
        timeLabel: formatCoordinatorRelativeTime(report.uploadedAt),
        statusLabel: 'Submitted',
        statusClassName: 'completed'
      });
    });

    evaluationsSnapshot.value.docs.forEach((doc) => {
      const evaluation = doc.data();
      if (evaluation.assignedCoordinatorId !== currentUser.uid) {
        return;
      }

      if (evaluation.submittedAt && evaluation.reportUrl) {
        activities.push({
          sortDate: getCoordinatorTimestampDate(evaluation.submittedAt),
          title: 'Evaluation Received',
          description: `${evaluation.employerName || 'An employer'} submitted an evaluation for ${evaluation.studentName || 'a student'}.`,
          timeLabel: formatCoordinatorRelativeTime(evaluation.submittedAt),
          statusLabel: 'Received',
          statusClassName: 'completed'
        });
        return;
      }

      if (evaluation.requestedAt) {
        activities.push({
          sortDate: getCoordinatorTimestampDate(evaluation.requestedAt),
          title: 'Evaluation Requested',
          description: `Requested an evaluation from ${evaluation.employerName || 'an employer'} for ${evaluation.studentName || 'a student'}.`,
          timeLabel: formatCoordinatorRelativeTime(evaluation.requestedAt),
          statusLabel: 'Requested',
          statusClassName: 'in-process'
        });
      }
    });

    if (announcementsSnapshotResult.status === 'fulfilled') {
      announcementsSnapshotResult.value.docs.forEach((doc) => {
        const announcement = doc.data();
        const createdAt = announcement.createdAt || announcement.updatedAt;
        if (!createdAt) {
          return;
        }

        activities.push({
          sortDate: getCoordinatorTimestampDate(createdAt),
          title: 'Announcement Sent',
          description: `Announcement sent to ${announcement.recipientCount || 0} assigned student${announcement.recipientCount === 1 ? '' : 's'}${announcement.subject ? `: ${announcement.subject}` : '.'}`,
          timeLabel: formatCoordinatorRelativeTime(createdAt),
          statusLabel: 'Sent',
          statusClassName: 'completed'
        });
      });
    }

    if (window.pseudoMailStore?.getCoordinatorAnnouncements) {
      window.pseudoMailStore.getCoordinatorAnnouncements(currentUser.uid).forEach((announcement) => {
        const createdAt = announcement.createdAt || announcement.updatedAt;
        if (!createdAt) {
          return;
        }

        activities.push({
          sortDate: getCoordinatorTimestampDate(createdAt),
          title: 'Announcement Sent',
          description: `Announcement sent to ${announcement.recipientCount || 0} assigned student${announcement.recipientCount === 1 ? '' : 's'}${announcement.subject ? `: ${announcement.subject}` : '.'}`,
          timeLabel: formatCoordinatorRelativeTime(createdAt),
          statusLabel: 'Sent',
          statusClassName: 'completed'
        });
      });
    }

    const renderedActivities = activities
      .filter((activity) => activity.sortDate instanceof Date && !Number.isNaN(activity.sortDate.getTime()))
      .sort((left, right) => right.sortDate.getTime() - left.sortDate.getTime())
      .slice(0, 8);

    if (!renderedActivities.length) {
      activityList.innerHTML = '<div class="applications-empty-state">No recent coordinator activity yet.</div>';
      return;
    }

    activityList.innerHTML = renderedActivities.map(createCoordinatorActivityItem).join('');
  } catch (error) {
    console.error('Unable to load coordinator recent activity:', error);
    activityList.innerHTML = '<div class="applications-empty-state">Unable to load recent activity right now.</div>';
  }
}

window.handleCoordinatorAnnouncement = function() {
  if (window.openDashboardSubscreen) {
    window.openDashboardSubscreen('announcements-compose');
    return;
  }

  window.alert('Unable to open the announcement composer right now.');
};

async function loadCoordinatorDashboardStats() {
  const studentCountElement = document.getElementById('coordinatorDashboardStudentCount');
  const employerCountElement = document.getElementById('coordinatorDashboardEmployerCount');
  const pendingApplicationCountElement = document.getElementById('coordinatorDashboardPendingApplicationCount');
  const submittedReportCountElement = document.getElementById('coordinatorDashboardSubmittedReportCount');

  if (!studentCountElement || !employerCountElement || !pendingApplicationCountElement || !submittedReportCountElement) {
    return;
  }

  try {
    const currentUser = await getCoordinatorCurrentUser();
    if (!currentUser) {
      return;
    }

    const [assignedStudentsSnapshot, employersSnapshot, applicationsSnapshot, reportsSnapshot] = await Promise.all([
      firebase.firestore()
        .collection('users')
        .where('role', '==', 'student')
        .where('assignedCoordinatorId', '==', currentUser.uid)
        .get(),
      firebase.firestore()
        .collection('users')
        .where('role', '==', 'employer')
        .get(),
      firebase.firestore()
        .collection('applications')
        .get(),
      firebase.firestore()
        .collection('workTermReports')
        .get()
    ]);

    const assignedStudentIds = new Set(assignedStudentsSnapshot.docs.map((doc) => doc.id));

    let pendingApplicationCount = 0;
    applicationsSnapshot.docs.forEach((doc) => {
      if (!assignedStudentIds.has(doc.id)) {
        return;
      }

      const application = doc.data();
      const hasUploadedDocuments = Boolean(application.resumeUrl || application.coverLetterUrl);
      const status = application.coordinatorStatus || application.status || 'pending';

      if (hasUploadedDocuments && (status === 'pending' || status === 'in_process')) {
        pendingApplicationCount += 1;
      }
    });

    const latestReportsByStudent = new Map();
    reportsSnapshot.docs.forEach((doc) => {
      const report = { id: doc.id, ...doc.data() };
      if (!assignedStudentIds.has(report.userId)) {
        return;
      }

      const currentLatest = latestReportsByStudent.get(report.userId);
      if (!currentLatest || getCoordinatorLatestReportDateValue(report) > getCoordinatorLatestReportDateValue(currentLatest)) {
        latestReportsByStudent.set(report.userId, report);
      }
    });

    let submittedReportCount = 0;
    latestReportsByStudent.forEach((report) => {
      if (report.reportUrl) {
        submittedReportCount += 1;
      }
    });

    studentCountElement.textContent = String(assignedStudentIds.size);
    employerCountElement.textContent = String(employersSnapshot.size);
    pendingApplicationCountElement.textContent = String(pendingApplicationCount);
    submittedReportCountElement.textContent = String(submittedReportCount);
  } catch (error) {
    console.error('Unable to load coordinator dashboard stats:', error);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('Coordinator dashboard loaded');
  
  // Role validation
  const userRole = localStorage.getItem('userRole');
  if (!userRole || userRole !== 'coordinator') {
    console.warn('Invalid role for coordinator dashboard:', userRole);
    window.location.href = '../pages/login.html';
    return;
  }

  if (window.backfillExistingStudentAssignments) {
    window.backfillExistingStudentAssignments().catch((error) => {
      console.error('Unable to backfill student assignments:', error);
    });
  }

  loadCoordinatorDashboardStats();
  loadCoordinatorRecentActivity();
  loadCoordinatorStudentMessages();
});
