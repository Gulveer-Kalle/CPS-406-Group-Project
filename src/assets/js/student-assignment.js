const STUDENT_ASSIGNMENT_USER_COLLECTION = 'users';
const STUDENT_ASSIGNMENT_SETTINGS_COLLECTION = 'settings';
const STUDENT_ASSIGNMENT_SETTINGS_DOC = 'studentAssignments';

function getAssignmentDisplayName(user) {
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.companyName || user.email || 'Unassigned';
}

function pickRandomAssignmentUser(users) {
  if (!users.length) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * users.length);
  return users[randomIndex];
}

async function fetchAssignmentUsersByRole(role) {
  const snapshot = await firebase.firestore()
    .collection(STUDENT_ASSIGNMENT_USER_COLLECTION)
    .where('role', '==', role)
    .get();

  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data()
  }));
}

function setAssignmentUserFields(update, keyPrefix, user) {
  if (!user) {
    update[`assigned${keyPrefix}Id`] = '';
    update[`assigned${keyPrefix}Name`] = '';
    update[`assigned${keyPrefix}Email`] = '';
    return;
  }

  update[`assigned${keyPrefix}Id`] = user.uid;
  update[`assigned${keyPrefix}Name`] = getAssignmentDisplayName(user);
  update[`assigned${keyPrefix}Email`] = user.email || '';
}

function syncAssignmentUser(update, studentData, keyPrefix, users) {
  const idKey = `assigned${keyPrefix}Id`;
  const nameKey = `assigned${keyPrefix}Name`;
  const emailKey = `assigned${keyPrefix}Email`;
  const currentAssignedId = studentData[idKey] || '';
  const currentAssignedUser = users.find((user) => user.uid === currentAssignedId);

  if (!currentAssignedId || !currentAssignedUser) {
    const replacementUser = pickRandomAssignmentUser(users);
    setAssignmentUserFields(update, keyPrefix, replacementUser);
    return;
  }

  const expectedName = getAssignmentDisplayName(currentAssignedUser);
  const expectedEmail = currentAssignedUser.email || '';

  if (studentData[nameKey] !== expectedName || studentData[emailKey] !== expectedEmail) {
    setAssignmentUserFields(update, keyPrefix, currentAssignedUser);
  }
}

function buildStudentAssignmentUpdate(studentData, coordinators, employers) {
  const update = {};

  syncAssignmentUser(update, studentData, 'Coordinator', coordinators);
  syncAssignmentUser(update, studentData, 'Employer', employers);

  if (Object.keys(update).length) {
    update.assignmentUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  return update;
}

window.createStudentAssignmentData = async function(studentData = {}) {
  const [coordinators, employers] = await Promise.all([
    fetchAssignmentUsersByRole('coordinator'),
    fetchAssignmentUsersByRole('employer')
  ]);

  return buildStudentAssignmentUpdate(studentData, coordinators, employers);
};

window.assignStudentRelationshipsIfMissing = async function(studentUid, studentData = {}) {
  if (!studentUid) {
    return {};
  }

  const assignmentUpdate = await window.createStudentAssignmentData(studentData);
  if (!Object.keys(assignmentUpdate).length) {
    return {};
  }

  await firebase.firestore()
    .collection(STUDENT_ASSIGNMENT_USER_COLLECTION)
    .doc(studentUid)
    .set(assignmentUpdate, { merge: true });

  return assignmentUpdate;
};

window.backfillExistingStudentAssignments = async function() {
  const [studentsSnapshot, coordinators, employers] = await Promise.all([
    firebase.firestore().collection(STUDENT_ASSIGNMENT_USER_COLLECTION).where('role', '==', 'student').get(),
    fetchAssignmentUsersByRole('coordinator'),
    fetchAssignmentUsersByRole('employer')
  ]);

  const updates = studentsSnapshot.docs.map((doc) => {
    const studentData = doc.data();
    const assignmentUpdate = buildStudentAssignmentUpdate(studentData, coordinators, employers);

    if (!Object.keys(assignmentUpdate).length) {
      return null;
    }

    return firebase.firestore()
      .collection(STUDENT_ASSIGNMENT_USER_COLLECTION)
      .doc(doc.id)
      .set(assignmentUpdate, { merge: true });
  }).filter(Boolean);

  if (!updates.length) {
    return 0;
  }

  await Promise.all(updates);
  return updates.length;
};

window.seedStudentsToCoordinatorByName = async function(nameFragment, limit = 4) {
  const normalizedFragment = String(nameFragment || '').trim().toLowerCase();
  if (!normalizedFragment || limit <= 0) {
    return 0;
  }

  const settingsRef = firebase.firestore()
    .collection(STUDENT_ASSIGNMENT_SETTINGS_COLLECTION)
    .doc(STUDENT_ASSIGNMENT_SETTINGS_DOC);

  const settingsDoc = await settingsRef.get();
  const seedKey = `seed_${normalizedFragment}_${limit}`;

  if (settingsDoc.exists && settingsDoc.data()?.[seedKey]) {
    return 0;
  }

  const [coordinators, studentsSnapshot] = await Promise.all([
    fetchAssignmentUsersByRole('coordinator'),
    firebase.firestore()
      .collection(STUDENT_ASSIGNMENT_USER_COLLECTION)
      .where('role', '==', 'student')
      .get()
  ]);

  const targetCoordinator = coordinators.find((coordinator) =>
    getAssignmentDisplayName(coordinator).toLowerCase().includes(normalizedFragment) ||
    String(coordinator.email || '').toLowerCase().includes(normalizedFragment)
  );

  if (!targetCoordinator) {
    return 0;
  }

  const students = studentsSnapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data()
  }));

  students.sort((left, right) => {
    const leftName = `${left.firstName || ''} ${left.lastName || ''}`.trim().toLowerCase();
    const rightName = `${right.firstName || ''} ${right.lastName || ''}`.trim().toLowerCase();
    return leftName.localeCompare(rightName);
  });

  const selectedStudents = students.slice(0, limit);
  if (!selectedStudents.length) {
    return 0;
  }

  const updates = selectedStudents.map((student) =>
    firebase.firestore()
      .collection(STUDENT_ASSIGNMENT_USER_COLLECTION)
      .doc(student.uid)
      .set({
        assignedCoordinatorId: targetCoordinator.uid,
        assignedCoordinatorName: getAssignmentDisplayName(targetCoordinator),
        assignedCoordinatorEmail: targetCoordinator.email || '',
        assignmentUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
  );

  await Promise.all(updates);
  await settingsRef.set({
    [seedKey]: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return updates.length;
};
