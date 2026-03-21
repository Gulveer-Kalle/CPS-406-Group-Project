let employerWorkTermStudents = [];
let employerWorkTermLatestReports = new Map();

function escapeEmployerWorkTermHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmployerWorkTermCurrentUser() {
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

function getEmployerWorkTermReportDateValue(report) {
  return report?.uploadedAt?.toDate ? report.uploadedAt.toDate().getTime() : 0;
}

function getEmployerWorkTermStatusPresentation(report) {
  if (!report?.reportUrl) {
    return { label: 'Not Submitted', className: 'rejected' };
  }

  return { label: 'Submitted', className: 'completed' };
}

function createEmployerWorkTermReportCard(student, report) {
  const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';
  const status = getEmployerWorkTermStatusPresentation(report);
  const hasReport = Boolean(report?.reportUrl);
  const note = hasReport
    ? 'Work term report submitted and ready for employer review.'
    : 'This assigned student has not submitted a work term report yet.';

  return `
    <div class="application-card coordinator-report-card">
      <div class="application-card-main">
        <div class="application-card-header">
          <span class="application-card-title">${escapeEmployerWorkTermHtml(studentName)}</span>
          <span class="status-badge ${escapeEmployerWorkTermHtml(status.className)}">${escapeEmployerWorkTermHtml(status.label)}</span>
        </div>
        <div class="application-card-email">${escapeEmployerWorkTermHtml(student.email || 'No email available')}</div>
        <div class="coordinator-report-meta">
          <span class="coordinator-report-meta-line"><strong>Upload:</strong> ${escapeEmployerWorkTermHtml(report?.uploadMonthYear || 'No report uploaded')}</span>
          <span class="coordinator-report-meta-line"><strong>Company:</strong> ${escapeEmployerWorkTermHtml(report?.companyName || student.assignedEmployerName || 'Not submitted')}</span>
          <span class="coordinator-report-meta-line"><strong>Job Title:</strong> ${escapeEmployerWorkTermHtml(report?.jobTitle || 'Not submitted')}</span>
        </div>
        <div class="coordinator-report-actions">
          ${hasReport
            ? `<a class="quick-view-btn" href="${escapeEmployerWorkTermHtml(report.reportUrl)}" target="_blank" rel="noopener noreferrer">View</a>`
            : '<span class="application-card-note">No report file</span>'}
        </div>
        <div class="application-card-note">${escapeEmployerWorkTermHtml(note)}</div>
      </div>
    </div>
  `;
}

function updateEmployerWorkTermSummary(students, latestReports) {
  const assignedEmployeeCountElement = document.getElementById('employerReportAssignedEmployeeCount');
  const submittedReportCountElement = document.getElementById('employerReportSubmittedCount');

  let submittedCount = 0;
  students.forEach((student) => {
    if (latestReports.get(student.uid)?.reportUrl) {
      submittedCount += 1;
    }
  });

  if (assignedEmployeeCountElement) {
    assignedEmployeeCountElement.textContent = String(students.length);
  }

  if (submittedReportCountElement) {
    submittedReportCountElement.textContent = String(submittedCount);
  }
}

async function fetchEmployerWorkTermReportData() {
  const currentUser = await getEmployerWorkTermCurrentUser();
  if (!currentUser) {
    return { students: [], latestReports: new Map(), hasUser: false };
  }

  const [studentsSnapshot, reportsSnapshot] = await Promise.all([
    firebase.firestore()
      .collection('users')
      .where('role', '==', 'student')
      .where('assignedEmployerId', '==', currentUser.uid)
      .get(),
    firebase.firestore().collection('workTermReports').get()
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

  const studentIds = new Set(students.map((student) => student.uid));
  const latestReports = new Map();

  reportsSnapshot.docs.forEach((doc) => {
    const report = { id: doc.id, ...doc.data() };
    if (!studentIds.has(report.userId)) {
      return;
    }

    const currentLatest = latestReports.get(report.userId);
    if (!currentLatest || getEmployerWorkTermReportDateValue(report) > getEmployerWorkTermReportDateValue(currentLatest)) {
      latestReports.set(report.userId, report);
    }
  });

  return { students, latestReports, hasUser: true };
}

async function renderEmployerWorkTermReports() {
  const list = document.getElementById('employerWorkTermReportList');
  if (!list) return;

  list.innerHTML = '<div class="applications-empty-state">Loading assigned student reports...</div>';

  try {
    const { students, latestReports, hasUser } = await fetchEmployerWorkTermReportData();
    employerWorkTermStudents = students;
    employerWorkTermLatestReports = latestReports;

    if (!hasUser) {
      list.innerHTML = '<div class="applications-empty-state">Unable to determine the current employer.</div>';
      return;
    }

    updateEmployerWorkTermSummary(students, latestReports);

    if (!students.length) {
      list.innerHTML = '<div class="applications-empty-state">No students are currently assigned to this employer.</div>';
      return;
    }

    list.innerHTML = students
      .map((student) => createEmployerWorkTermReportCard(student, latestReports.get(student.uid)))
      .join('');
  } catch (error) {
    console.error('Unable to load employer work term reports:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load work term reports right now.</div>';
  }
}

window.initializeEmployerWorkTermReportPages = function() {
  const list = document.getElementById('employerWorkTermReportList');
  if (!list) return;

  renderEmployerWorkTermReports();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeEmployerWorkTermReportPages();
});
