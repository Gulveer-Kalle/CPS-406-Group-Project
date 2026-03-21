function getEmployerDashboardCurrentUser() {
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

function getEmployerDashboardTimestampDate(value) {
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

function getEmployerDashboardRelativeTime(value) {
  const date = getEmployerDashboardTimestampDate(value);
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

function escapeEmployerDashboardHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmployerDashboardStudentName(student, fallbackName) {
  const studentName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim();
  return studentName || fallbackName || student?.email || 'A student';
}

function getEmployerDashboardReportDateValue(report) {
  return report?.uploadedAt?.toDate ? report.uploadedAt.toDate().getTime() : 0;
}

function setEmployerDashboardHeader(userRecord) {
  const heading = document.getElementById('employerDashboardHeading');
  const subtitle = document.getElementById('employerDashboardSubtitle');

  if (heading) {
    const displayName = userRecord?.companyName
      || `${userRecord?.firstName || ''} ${userRecord?.lastName || ''}`.trim()
      || 'Employer';
    heading.textContent = `Welcome, ${displayName}!`;
  }

  if (subtitle) {
    const companyLabel = userRecord?.companyName || 'your company';
    subtitle.textContent = `Manage students, reports, and evaluation requests for ${companyLabel}.`;
  }
}

function createEmployerDashboardActivityItem(activity) {
  let actionHtml = '';

  if (activity.href) {
    actionHtml = `
      <a
        class="dashboard-inline-action-btn"
        href="${escapeEmployerDashboardHtml(activity.href)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeEmployerDashboardHtml(activity.actionLabel || 'View')}
      </a>
    `;
  } else if (activity.navTarget) {
    actionHtml = `
      <button
        class="dashboard-inline-action-btn"
        type="button"
        data-employer-dashboard-nav="${escapeEmployerDashboardHtml(activity.navTarget)}"
      >
        ${escapeEmployerDashboardHtml(activity.actionLabel || 'Open')}
      </button>
    `;
  }

  return `
    <div class="term-item">
      <div class="term-info">
        <span class="term-season">${escapeEmployerDashboardHtml(activity.title)}</span>
        <span class="term-employer">${escapeEmployerDashboardHtml(activity.description)}</span>
        <span class="term-grade">${escapeEmployerDashboardHtml(activity.timeLabel)}</span>
      </div>
      <div class="term-status">
        <span class="status-badge ${escapeEmployerDashboardHtml(activity.statusClassName)}">${escapeEmployerDashboardHtml(activity.statusLabel)}</span>
        ${actionHtml}
      </div>
    </div>
  `;
}

function bindEmployerDashboardActivityButtons() {
  document.querySelectorAll('[data-employer-dashboard-nav]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-employer-dashboard-nav');
      if (!target) {
        return;
      }

      const navItem = document.querySelector(`.nav-item[data-url="${target}"]`);
      if (navItem) {
        navItem.click();
      }
    });
  });
}

async function fetchEmployerDashboardData() {
  const currentUser = await getEmployerDashboardCurrentUser();
  if (!currentUser) {
    return {
      currentUser: null,
      userRecord: null,
      assignedStudents: [],
      assignedStudentsById: new Map(),
      reports: [],
      latestReportsByStudent: new Map(),
      evaluations: []
    };
  }

  const [
    userSnapshot,
    assignedStudentsSnapshot,
    reportsSnapshot,
    evaluationsSnapshot
  ] = await Promise.all([
    firebase.firestore().collection('users').doc(currentUser.uid).get(),
    firebase.firestore()
      .collection('users')
      .where('role', '==', 'student')
      .where('assignedEmployerId', '==', currentUser.uid)
      .get(),
    firebase.firestore().collection('workTermReports').get(),
    firebase.firestore()
      .collection('evaluationReports')
      .where('employerId', '==', currentUser.uid)
      .get()
  ]);

  const userRecord = userSnapshot.exists ? userSnapshot.data() : null;
  const assignedStudents = assignedStudentsSnapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data()
  }));

  assignedStudents.sort((left, right) => {
    const leftName = `${left.firstName || ''} ${left.lastName || ''}`.trim().toLowerCase();
    const rightName = `${right.firstName || ''} ${right.lastName || ''}`.trim().toLowerCase();
    return leftName.localeCompare(rightName);
  });

  const assignedStudentsById = new Map(
    assignedStudents.map((student) => [student.uid, student])
  );
  const assignedStudentIds = new Set(assignedStudents.map((student) => student.uid));

  const reports = reportsSnapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter((report) => assignedStudentIds.has(report.userId) && report.reportUrl);

  const latestReportsByStudent = new Map();
  reports.forEach((report) => {
    const currentLatest = latestReportsByStudent.get(report.userId);
    if (!currentLatest || getEmployerDashboardReportDateValue(report) > getEmployerDashboardReportDateValue(currentLatest)) {
      latestReportsByStudent.set(report.userId, report);
    }
  });

  const evaluations = evaluationsSnapshot.docs.map((doc) => ({
    studentId: doc.id,
    ...doc.data()
  }));

  return {
    currentUser,
    userRecord,
    assignedStudents,
    assignedStudentsById,
    reports,
    latestReportsByStudent,
    evaluations
  };
}

function renderEmployerDashboardStats(data) {
  const employeeCountElement = document.getElementById('employerDashboardEmployeeCount');
  const reportsReceivedCountElement = document.getElementById('employerDashboardReportsReceivedCount');
  const evaluationsSubmittedCountElement = document.getElementById('employerDashboardEvaluationsSubmittedCount');
  const pendingReviewsCountElement = document.getElementById('employerDashboardPendingReviewsCount');

  if (employeeCountElement) {
    employeeCountElement.textContent = String(data.assignedStudents.length);
  }

  if (reportsReceivedCountElement) {
    reportsReceivedCountElement.textContent = String(data.reports.length);
  }

  if (evaluationsSubmittedCountElement) {
    const submittedEvaluationCount = data.evaluations.filter((evaluation) => (
      evaluation.status === 'submitted' && evaluation.reportUrl
    )).length;
    evaluationsSubmittedCountElement.textContent = String(submittedEvaluationCount);
  }

  if (pendingReviewsCountElement) {
    const pendingReviewCount = data.evaluations.filter((evaluation) => evaluation.status === 'requested').length;
    pendingReviewsCountElement.textContent = String(pendingReviewCount);
  }
}

function buildEmployerDashboardActivities(data) {
  const activities = [];

  data.assignedStudents.forEach((student) => {
    if (!student.assignmentUpdatedAt) {
      return;
    }

    const studentName = getEmployerDashboardStudentName(student);
    activities.push({
      sortDate: getEmployerDashboardTimestampDate(student.assignmentUpdatedAt),
      title: 'Employee Assigned',
      description: `${studentName} is assigned to your employer account.`,
      timeLabel: getEmployerDashboardRelativeTime(student.assignmentUpdatedAt),
      statusLabel: 'Active',
      statusClassName: 'completed',
      navTarget: 'employees',
      actionLabel: 'Open'
    });
  });

  data.reports.forEach((report) => {
    const student = data.assignedStudentsById.get(report.userId);
    const studentName = getEmployerDashboardStudentName(student, report.studentName);

    activities.push({
      sortDate: getEmployerDashboardTimestampDate(report.uploadedAt),
      title: 'Work-term Report Received',
      description: `${studentName} submitted a work-term report${report.companyName ? ` for ${report.companyName}` : ''}.`,
      timeLabel: getEmployerDashboardRelativeTime(report.uploadedAt),
      statusLabel: 'Received',
      statusClassName: 'neutral',
      href: report.reportUrl,
      actionLabel: 'View'
    });
  });

  data.evaluations.forEach((evaluation) => {
    const student = data.assignedStudentsById.get(evaluation.studentId);
    const studentName = getEmployerDashboardStudentName(student, evaluation.studentName);

    if (evaluation.status === 'submitted' && evaluation.submittedAt && evaluation.reportUrl) {
      activities.push({
        sortDate: getEmployerDashboardTimestampDate(evaluation.submittedAt),
        title: 'Evaluation Submitted',
        description: `You submitted an evaluation report for ${studentName}.`,
        timeLabel: getEmployerDashboardRelativeTime(evaluation.submittedAt),
        statusLabel: 'Submitted',
        statusClassName: 'completed',
        href: evaluation.reportUrl,
        actionLabel: 'View'
      });
      return;
    }

    if (evaluation.status === 'requested' && evaluation.requestedAt) {
      activities.push({
        sortDate: getEmployerDashboardTimestampDate(evaluation.requestedAt),
        title: 'Evaluation Requested',
        description: `${studentName} is waiting for an evaluation report submission.`,
        timeLabel: getEmployerDashboardRelativeTime(evaluation.requestedAt),
        statusLabel: 'Pending',
        statusClassName: 'pending',
        navTarget: 'evaluation-reports',
        actionLabel: 'Open'
      });
    }
  });

  return activities
    .filter((activity) => activity.sortDate instanceof Date && !Number.isNaN(activity.sortDate.getTime()))
    .sort((left, right) => right.sortDate.getTime() - left.sortDate.getTime())
    .slice(0, 8);
}

function renderEmployerDashboardRecentActivity(data) {
  const activityList = document.getElementById('employerDashboardRecentActivityList');
  if (!activityList) {
    return;
  }

  const activities = buildEmployerDashboardActivities(data);
  if (!activities.length) {
    activityList.innerHTML = '<div class="applications-empty-state">No recent employer activity yet.</div>';
    return;
  }

  activityList.innerHTML = activities.map(createEmployerDashboardActivityItem).join('');
  bindEmployerDashboardActivityButtons();
}

async function loadEmployerDashboard() {
  const activityList = document.getElementById('employerDashboardRecentActivityList');
  if (activityList) {
    activityList.innerHTML = '<div class="applications-empty-state">Loading recent activity...</div>';
  }

  try {
    const data = await fetchEmployerDashboardData();
    if (!data.currentUser) {
      if (activityList) {
        activityList.innerHTML = '<div class="applications-empty-state">Unable to determine the current employer.</div>';
      }
      return;
    }

    setEmployerDashboardHeader(data.userRecord);
    renderEmployerDashboardStats(data);
    renderEmployerDashboardRecentActivity(data);
  } catch (error) {
    console.error('Unable to load employer dashboard:', error);
    if (activityList) {
      activityList.innerHTML = '<div class="applications-empty-state">Unable to load recent activity right now.</div>';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const userRole = localStorage.getItem('userRole');
  if (!userRole || userRole !== 'employer') {
    console.warn('Invalid role for employer dashboard:', userRole);
    window.location.href = '../pages/login.html';
    return;
  }

  loadEmployerDashboard();
});
