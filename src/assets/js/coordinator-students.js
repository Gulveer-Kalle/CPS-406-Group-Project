let coordinatorAssignedStudents = [];
let coordinatorStudentSearchTerm = '';
let coordinatorStudentLoadSummary = [];
let coordinatorStudentCoordinatorOptions = [];
let coordinatorStudentEmployerOptions = [];

const COORDINATOR_STUDENT_EVALUATION_COLLECTION = 'evaluationReports';

function escapeCoordinatorStudentHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function getCoordinatorStudentUserDisplayName(user) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    || user.companyName
    || user.email
    || 'Unassigned';
}

function buildCoordinatorStudentAssignmentOptions(users, selectedUid, fallbackLabel) {
  if (!users.length) {
    return `<option value="">${escapeCoordinatorStudentHtml(fallbackLabel)}</option>`;
  }

  return users.map((user) => `
    <option value="${escapeCoordinatorStudentHtml(user.uid)}" ${user.uid === selectedUid ? 'selected' : ''}>
      ${escapeCoordinatorStudentHtml(getCoordinatorStudentUserDisplayName(user))}
    </option>
  `).join('');
}

function createCoordinatorStudentAssignmentEditor(student, assignmentType) {
  const isCoordinatorEditor = assignmentType === 'coordinator';
  const editorTitle = isCoordinatorEditor ? 'Change Coordinator' : 'Change Employer';
  const selectLabel = isCoordinatorEditor ? 'Coordinator' : 'Employer';
  const saveLabel = 'Done';
  const selectedUid = isCoordinatorEditor ? (student.assignedCoordinatorId || '') : (student.assignedEmployerId || '');
  const options = isCoordinatorEditor
    ? buildCoordinatorStudentAssignmentOptions(
        coordinatorStudentCoordinatorOptions,
        selectedUid,
        'No coordinators available'
      )
    : buildCoordinatorStudentAssignmentOptions(
        coordinatorStudentEmployerOptions,
        selectedUid,
        'No employers available'
      );

  const hasOptions = isCoordinatorEditor
    ? coordinatorStudentCoordinatorOptions.length > 0
    : coordinatorStudentEmployerOptions.length > 0;

  return `
    <div class="assignment-editor" data-assignment-panel="${assignmentType}" hidden>
      <div class="assignment-editor-header">
        <span class="assignment-editor-title">${editorTitle}</span>
        <button class="quick-view-btn assignment-editor-cancel" type="button" data-close-assignment-panel="${assignmentType}">Cancel</button>
      </div>
      <div class="assignment-editor-body">
        <div class="form-group">
          <label for="${assignmentType}Assignment-${escapeCoordinatorStudentHtml(student.uid)}">${selectLabel}</label>
          <select
            id="${assignmentType}Assignment-${escapeCoordinatorStudentHtml(student.uid)}"
            data-assignment-select="${assignmentType}"
            ${hasOptions ? '' : 'disabled'}
          >
            ${options}
          </select>
        </div>
        <div class="assignment-editor-actions">
          <button
            class="btn-primary assignment-editor-done"
            type="button"
            data-save-assignment="${assignmentType}"
            ${hasOptions ? '' : 'disabled'}
          >
            ${saveLabel}
          </button>
        </div>
      </div>
    </div>
  `;
}

function createCoordinatorAssignedStudentCard(student) {
  const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';
  const assignedEmployer = student.assignedEmployerName || 'No employer assigned';
  const studentEmail = student.email || '';

  return `
    <div class="application-card coordinator-student-card" data-coordinator-student-card="${escapeCoordinatorStudentHtml(student.uid)}">
      <div class="application-card-main">
        <div class="application-card-header">
          <span class="application-card-title">${escapeCoordinatorStudentHtml(studentName)}</span>
          <span class="status-badge completed">Assigned</span>
        </div>
        <div class="application-card-email">${escapeCoordinatorStudentHtml(studentEmail || 'No email available')}</div>
        <div class="coordinator-report-meta">
          <span class="coordinator-report-meta-line"><strong>Employer:</strong> ${escapeCoordinatorStudentHtml(assignedEmployer)}</span>
          <span class="coordinator-report-meta-line"><strong>Coordinator:</strong> ${escapeCoordinatorStudentHtml(student.assignedCoordinatorName || 'Current coordinator')}</span>
        </div>
        <div class="coordinator-student-inline-actions">
          <button class="quick-view-btn student-email-btn" type="button" data-student-email="${escapeCoordinatorStudentHtml(studentEmail)}">
            Email
          </button>
          <button class="quick-view-btn" type="button" data-open-assignment-panel="coordinator">
            Change Coordinator
          </button>
          <button class="quick-view-btn" type="button" data-open-assignment-panel="employer">
            Change Employer
          </button>
        </div>
        <div class="assignment-editor-wrap">
          ${createCoordinatorStudentAssignmentEditor(student, 'coordinator')}
          ${createCoordinatorStudentAssignmentEditor(student, 'employer')}
        </div>
      </div>
    </div>
  `;
}

function updateCoordinatorAssignedStudentSummary(students) {
  const countElement = document.getElementById('coordinatorAssignedStudentCount');
  const emailCountElement = document.getElementById('coordinatorAssignedStudentEmailCount');
  const loadListElement = document.getElementById('coordinatorStudentLoadList');

  if (countElement) {
    countElement.textContent = String(students.length);
  }

  if (emailCountElement) {
    const emailCount = students.filter((student) => Boolean(student.email)).length;
    emailCountElement.textContent = String(emailCount);
  }

  if (loadListElement) {
    if (!coordinatorStudentLoadSummary.length) {
      loadListElement.innerHTML = '<span class="applications-empty-state">No coordinators found.</span>';
    } else {
      loadListElement.innerHTML = coordinatorStudentLoadSummary.map((item) => `
        <div class="coordinator-load-item">
          <span class="coordinator-load-name">${escapeCoordinatorStudentHtml(item.name)}</span>
          <span class="coordinator-load-count">${item.count}</span>
        </div>
      `).join('');
    }
  }
}

function bindCoordinatorStudentSearch() {
  const searchInput = document.getElementById('coordinatorStudentSearch');
  if (!searchInput || searchInput.dataset.bound === 'true') return;

  searchInput.dataset.bound = 'true';
  searchInput.addEventListener('input', () => {
    coordinatorStudentSearchTerm = searchInput.value.trim().toLowerCase();
    renderCoordinatorAssignedStudentsList();
  });
}

function closeCoordinatorStudentAssignmentPanels(card) {
  card.querySelectorAll('[data-assignment-panel]').forEach((panel) => {
    panel.hidden = true;
  });
}

function bindCoordinatorStudentAssignmentButtons() {
  document.querySelectorAll('[data-open-assignment-panel]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const card = button.closest('[data-coordinator-student-card]');
      const panelType = button.getAttribute('data-open-assignment-panel');
      const targetPanel = card?.querySelector(`[data-assignment-panel="${panelType}"]`);

      if (!card || !targetPanel) {
        return;
      }

      const wasHidden = targetPanel.hidden;
      closeCoordinatorStudentAssignmentPanels(card);
      targetPanel.hidden = !wasHidden ? true : false;

      if (!targetPanel.hidden) {
        const select = targetPanel.querySelector('[data-assignment-select]');
        if (select) {
          select.focus();
        }
      }
    });
  });

  document.querySelectorAll('[data-close-assignment-panel]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const card = button.closest('[data-coordinator-student-card]');
      if (!card) {
        return;
      }

      closeCoordinatorStudentAssignmentPanels(card);
    });
  });
}

async function syncCoordinatorStudentEvaluationAssignment(student, nextAssignment) {
  const evaluationRef = firebase.firestore()
    .collection(COORDINATOR_STUDENT_EVALUATION_COLLECTION)
    .doc(student.uid);

  const evaluationSnapshot = await evaluationRef.get();
  if (!evaluationSnapshot.exists) {
    return;
  }

  const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';

  await evaluationRef.set({
    studentId: student.uid,
    studentName: studentName,
    studentEmail: student.email || '',
    assignedCoordinatorId: nextAssignment.assignedCoordinatorId || '',
    assignedCoordinatorName: nextAssignment.assignedCoordinatorName || '',
    employerId: nextAssignment.assignedEmployerId || '',
    employerName: nextAssignment.assignedEmployerName || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function updateCoordinatorStudentAssignment(studentUid, assignmentType, button) {
  const student = coordinatorAssignedStudents.find((entry) => entry.uid === studentUid);
  if (!student) {
    return;
  }

  const card = button.closest('[data-coordinator-student-card]');
  const panel = button.closest('[data-assignment-panel]');
  const select = panel?.querySelector(`[data-assignment-select="${assignmentType}"]`);
  const selectedUid = select?.value || '';

  if (!card || !panel || !select || !selectedUid) {
    window.alert(`Please choose a ${assignmentType}.`);
    return;
  }

  const userOptions = assignmentType === 'coordinator'
    ? coordinatorStudentCoordinatorOptions
    : coordinatorStudentEmployerOptions;
  const selectedUser = userOptions.find((entry) => entry.uid === selectedUid);

  if (!selectedUser) {
    window.alert(`Unable to find the selected ${assignmentType}.`);
    return;
  }

  const nextAssignment = {
    assignedCoordinatorId: student.assignedCoordinatorId || '',
    assignedCoordinatorName: student.assignedCoordinatorName || '',
    assignedCoordinatorEmail: student.assignedCoordinatorEmail || '',
    assignedEmployerId: student.assignedEmployerId || '',
    assignedEmployerName: student.assignedEmployerName || '',
    assignedEmployerEmail: student.assignedEmployerEmail || ''
  };

  if (assignmentType === 'coordinator') {
    nextAssignment.assignedCoordinatorId = selectedUser.uid;
    nextAssignment.assignedCoordinatorName = getCoordinatorStudentUserDisplayName(selectedUser);
    nextAssignment.assignedCoordinatorEmail = selectedUser.email || '';
  } else {
    nextAssignment.assignedEmployerId = selectedUser.uid;
    nextAssignment.assignedEmployerName = getCoordinatorStudentUserDisplayName(selectedUser);
    nextAssignment.assignedEmployerEmail = selectedUser.email || '';
  }

  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    await firebase.firestore()
      .collection('users')
      .doc(studentUid)
      .set({
        ...nextAssignment,
        assignmentUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    await syncCoordinatorStudentEvaluationAssignment(student, nextAssignment);
    await renderCoordinatorAssignedStudents();
  } catch (error) {
    console.error(`Unable to update student ${assignmentType}:`, error);
    window.alert(`Unable to update the student ${assignmentType} right now.`);
    button.disabled = false;
    button.textContent = 'Done';
  }
}

function bindCoordinatorStudentAssignmentSaves() {
  document.querySelectorAll('[data-save-assignment]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      const assignmentType = button.getAttribute('data-save-assignment');
      const card = button.closest('[data-coordinator-student-card]');
      const studentUid = card?.getAttribute('data-coordinator-student-card');

      if (!assignmentType || !studentUid) {
        return;
      }

      await updateCoordinatorStudentAssignment(studentUid, assignmentType, button);
    });
  });
}

function renderCoordinatorAssignedStudentsList() {
  const list = document.getElementById('coordinatorAssignedStudentsList');
  if (!list) return;

  updateCoordinatorAssignedStudentSummary(coordinatorAssignedStudents);
  bindCoordinatorStudentSearch();

  const filteredStudents = coordinatorAssignedStudents.filter((student) => {
    if (!coordinatorStudentSearchTerm) {
      return true;
    }

    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim().toLowerCase();
    const email = (student.email || '').toLowerCase();
    return studentName.includes(coordinatorStudentSearchTerm) || email.includes(coordinatorStudentSearchTerm);
  });

  if (!filteredStudents.length) {
    list.innerHTML = '<div class="applications-empty-state">No assigned students match the current search.</div>';
    return;
  }

  list.innerHTML = filteredStudents.map(createCoordinatorAssignedStudentCard).join('');
  bindCoordinatorStudentEmailButtons();
  bindCoordinatorStudentAssignmentButtons();
  bindCoordinatorStudentAssignmentSaves();
}

function bindCoordinatorStudentEmailButtons() {
  document.querySelectorAll('[data-student-email]').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      const studentEmail = button.dataset.studentEmail || '';

      if (!studentEmail) {
        window.alert('No student email is available for this account yet.');
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(studentEmail);
          window.alert(`Student email copied:\n\n${studentEmail}`);
          return;
        }
      } catch (error) {
        console.warn('Unable to copy student email to clipboard:', error);
      }

      window.alert(`Student email:\n\n${studentEmail}`);
    });
  });
}

async function renderCoordinatorAssignedStudents() {
  const list = document.getElementById('coordinatorAssignedStudentsList');
  if (!list) return;

  list.innerHTML = '<div class="applications-empty-state">Loading assigned students...</div>';

  try {
    if (window.seedStudentsToCoordinatorByName) {
      await window.seedStudentsToCoordinatorByName('ufkes', 4);
    }

    const currentUser = await getCoordinatorCurrentUser();
    if (!currentUser) {
      list.innerHTML = '<div class="applications-empty-state">Unable to determine the current coordinator.</div>';
      return;
    }

    const [coordinatorsSnapshot, employersSnapshot, assignedToCurrentSnapshot, allStudentsSnapshot] = await Promise.all([
      firebase.firestore().collection('users').where('role', '==', 'coordinator').get(),
      firebase.firestore().collection('users').where('role', '==', 'employer').get(),
      firebase.firestore()
        .collection('users')
        .where('role', '==', 'student')
        .where('assignedCoordinatorId', '==', currentUser.uid)
        .get(),
      firebase.firestore().collection('users').where('role', '==', 'student').get()
    ]);

    const coordinatorCountMap = new Map();
    allStudentsSnapshot.docs.forEach((doc) => {
      const assignedCoordinatorId = doc.data().assignedCoordinatorId;
      if (!assignedCoordinatorId) return;
      coordinatorCountMap.set(assignedCoordinatorId, (coordinatorCountMap.get(assignedCoordinatorId) || 0) + 1);
    });

    coordinatorStudentLoadSummary = coordinatorsSnapshot.docs.map((doc) => {
      const data = doc.data();
      const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'Unnamed Coordinator';
      return {
        uid: doc.id,
        name,
        count: coordinatorCountMap.get(doc.id) || 0
      };
    }).sort((left, right) => left.name.localeCompare(right.name));

    coordinatorStudentCoordinatorOptions = coordinatorsSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data()
    })).sort((left, right) => {
      return getCoordinatorStudentUserDisplayName(left).localeCompare(getCoordinatorStudentUserDisplayName(right));
    });

    coordinatorStudentEmployerOptions = employersSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data()
    })).sort((left, right) => {
      return getCoordinatorStudentUserDisplayName(left).localeCompare(getCoordinatorStudentUserDisplayName(right));
    });

    coordinatorAssignedStudents = assignedToCurrentSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data()
    }));

    coordinatorAssignedStudents.sort((left, right) => {
      const leftName = `${left.firstName || ''} ${left.lastName || ''}`.trim().toLowerCase();
      const rightName = `${right.firstName || ''} ${right.lastName || ''}`.trim().toLowerCase();
      return leftName.localeCompare(rightName);
    });

    if (!coordinatorAssignedStudents.length) {
      updateCoordinatorAssignedStudentSummary([]);
      list.innerHTML = '<div class="applications-empty-state">No students are currently assigned to this coordinator.</div>';
      return;
    }

    renderCoordinatorAssignedStudentsList();
  } catch (error) {
    console.error('Unable to load assigned students:', error);
    list.innerHTML = '<div class="applications-empty-state">Unable to load assigned students right now.</div>';
  }
}

window.initializeCoordinatorStudentsPage = function() {
  const list = document.getElementById('coordinatorAssignedStudentsList');
  if (!list) return;

  renderCoordinatorAssignedStudents();
};

document.addEventListener('DOMContentLoaded', () => {
  window.initializeCoordinatorStudentsPage();
});
