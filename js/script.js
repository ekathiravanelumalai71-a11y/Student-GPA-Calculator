"use strict";

const state = {
  subjects: [],
  searchTerm: "",
  sortBy: "recent",
  editingSubjectId: null,
  lastDeletedState: null,
  pendingDeleteId: null,
  pendingDeleteAll: false
};

const gradeOrder = {
  "A+": 5,
  A: 4,
  "B+": 3,
  B: 2,
  "C+": 1,
  C: 0,
  D: -1,
  F: -2
};

const elements = {
  form: document.getElementById("gpaForm"),
  subjectName: document.getElementById("subjectName"),
  credits: document.getElementById("credits"),
  grade: document.getElementById("grade"),
  addSubjectButton: document.getElementById("addSubjectBtn"),
  cancelEditButton: document.getElementById("cancelEditBtn"),
  calculateButton: document.getElementById("calculateBtn"),
  statusMessage: document.getElementById("statusMessage"),
  subjectList: document.getElementById("subjectList"),
  subjectSearch: document.getElementById("subjectSearch"),
  subjectSort: document.getElementById("subjectSort"),
  deleteAllButton: document.getElementById("deleteAllBtn"),
  subjectCountText: document.getElementById("subjectCountText"),
  totalSubjectsValue: document.getElementById("totalSubjectsValue"),
  totalCreditsValue: document.getElementById("totalCreditsValue"),
  toast: document.getElementById("toast"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalCancelButton: document.getElementById("modalCancelBtn"),
  modalConfirmButton: document.getElementById("modalConfirmBtn"),
  modalTitle: document.getElementById("modalTitle"),
  modalMessage: document.getElementById("modalMessage")
};

function setStatusMessage(message, type = "info") {
  if (!elements.statusMessage) {
    return;
  }

  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `form-status ${type}`;
}

function clearErrors() {
  const fieldIds = ["subjectName", "credits", "grade"];

  fieldIds.forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    const error = document.getElementById(`${fieldId}Error`);

    if (input) {
      input.classList.remove("input-error", "input-success");
    }

    if (error) {
      error.textContent = "";
    }
  });
}

function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);

  if (input) {
    input.classList.remove("input-success");
    input.classList.add("input-error");
  }

  if (error) {
    error.textContent = message;
  }
}

function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);

  if (input) {
    input.classList.remove("input-error");
    input.classList.add("input-success");
  }

  if (error) {
    error.textContent = "";
  }
}

function validateSubjectName(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Subject name is required.";
  }

  if (trimmedValue.length < 2) {
    return "Subject name must contain at least 2 characters.";
  }

  if (trimmedValue.length > 100) {
    return "Subject name must be less than 100 characters.";
  }

  return "";
}

function validateCredits(value) {
  if (!value) {
    return "Credits are required.";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "Please enter a valid credit value.";
  }

  if (numericValue < 1) {
    return "Credits must be at least 1.";
  }

  if (numericValue > 10) {
    return "Credits cannot be greater than 10.";
  }

  return "";
}

function validateGrade(value) {
  const validGrades = ["A+", "A", "B+", "B", "C+", "C", "D", "F"];

  if (!value) {
    return "Please select a grade.";
  }

  if (!validGrades.includes(value)) {
    return "Please select a valid grade.";
  }

  return "";
}

function validateForm() {
  clearErrors();

  const subjectName = elements.subjectName.value;
  const credits = elements.credits.value;
  const grade = elements.grade.value;

  const nameError = validateSubjectName(subjectName);
  const creditsError = validateCredits(credits);
  const gradeError = validateGrade(grade);

  if (nameError) {
    setFieldError("subjectName", nameError);
  } else {
    clearFieldError("subjectName");
  }

  if (creditsError) {
    setFieldError("credits", creditsError);
  } else {
    clearFieldError("credits");
  }

  if (gradeError) {
    setFieldError("grade", gradeError);
  } else {
    clearFieldError("grade");
  }

  return !nameError && !creditsError && !gradeError;
}

function normalizeSubjectName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function calculateTotalCredits() {
  return state.subjects.reduce((total, subject) => total + Number(subject.credits), 0);
}

function updateSummary() {
  const totalSubjects = state.subjects.length;
  const totalCredits = calculateTotalCredits();

  if (elements.totalSubjectsValue) {
    elements.totalSubjectsValue.textContent = String(totalSubjects);
  }

  if (elements.totalCreditsValue) {
    elements.totalCreditsValue.textContent = String(totalCredits);
  }

  if (elements.subjectCountText) {
    const label = totalSubjects === 1 ? "subject added" : "subjects added";
    elements.subjectCountText.textContent = `${totalSubjects} ${label}`;
  }
}

function sortSubjects() {
  const sortedSubjects = [...state.subjects];

  sortedSubjects.sort((left, right) => {
    switch (state.sortBy) {
      case "name-asc":
        return left.name.localeCompare(right.name) || right.credits - left.credits;
      case "name-desc":
        return right.name.localeCompare(left.name) || right.credits - left.credits;
      case "credits-desc":
        return right.credits - left.credits || left.name.localeCompare(right.name);
      case "grade-desc": {
        const leftGrade = gradeOrder[left.grade] ?? -999;
        const rightGrade = gradeOrder[right.grade] ?? -999;
        return rightGrade - leftGrade || left.name.localeCompare(right.name);
      }
      case "recent":
      default:
        return Number(right.id) - Number(left.id);
    }
  });

  return sortedSubjects;
}

function getVisibleSubjects() {
  const searchText = state.searchTerm.trim().toLowerCase();
  const sortedSubjects = sortSubjects();

  if (!searchText) {
    return sortedSubjects;
  }

  return sortedSubjects.filter((subject) => subject.name.toLowerCase().includes(searchText));
}

function updateAddButtonState() {
  if (!elements.addSubjectButton) {
    return;
  }

  elements.addSubjectButton.textContent = state.editingSubjectId !== null ? "Update Subject" : "+ Add Subject";

  if (elements.cancelEditButton) {
    elements.cancelEditButton.style.display = state.editingSubjectId !== null ? "inline-flex" : "none";
  }
}

function renderSubjects() {
  if (!elements.subjectList) {
    return;
  }

  const visibleSubjects = getVisibleSubjects();
  elements.subjectList.innerHTML = "";

  if (visibleSubjects.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-subject-list";

    const title = document.createElement("strong");
    title.textContent = state.searchTerm.trim()
      ? "No matching subjects found"
      : "No subjects added yet";

    const message = document.createElement("span");
    message.textContent = state.searchTerm.trim()
      ? "Try another search term or clear the filter."
      : "Add your first subject using the form above.";

    emptyState.appendChild(title);
    emptyState.appendChild(message);
    elements.subjectList.appendChild(emptyState);
    updateSummary();
    return;
  }

  visibleSubjects.forEach((subject, index) => {
    const item = document.createElement("div");
    item.className = "subject-item";

    const serial = document.createElement("span");
    serial.className = "subject-serial";
    serial.textContent = `#${index + 1}`;

    const nameWrap = document.createElement("div");
    nameWrap.className = "subject-name-wrap";

    const subjectName = document.createElement("span");
    subjectName.className = "subject-name";
    subjectName.textContent = subject.name;

    const subjectDetail = document.createElement("span");
    subjectDetail.className = "subject-detail";
    subjectDetail.textContent = `${subject.credits} credit${subject.credits === 1 ? "" : "s"}`;

    nameWrap.appendChild(subjectName);
    nameWrap.appendChild(subjectDetail);

    const creditBadge = document.createElement("span");
    creditBadge.className = "subject-badge";
    creditBadge.textContent = `${subject.credits} Credits`;

    const gradeBadge = document.createElement("span");
    gradeBadge.className = "grade-badge";
    gradeBadge.textContent = subject.grade;

    const actions = document.createElement("div");
    actions.className = "subject-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "subject-action-button";
    editButton.dataset.action = "edit";
    editButton.dataset.id = String(subject.id);
    editButton.textContent = "Edit";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary-action-button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = String(subject.id);
    deleteButton.textContent = "Delete";

    actions.append(editButton, deleteButton);
    item.append(serial, nameWrap, creditBadge, gradeBadge, actions);
    elements.subjectList.appendChild(item);
  });

  updateSummary();
}

function hideToast() {
  if (!elements.toast) {
    return;
  }

  elements.toast.classList.remove("visible");
  elements.toast.innerHTML = "";
}

function showToast(message, undoHandler = null) {
  if (!elements.toast) {
    return;
  }

  const messageText = document.createElement("span");
  messageText.textContent = message;

  elements.toast.innerHTML = "";
  elements.toast.appendChild(messageText);

  if (typeof undoHandler === "function") {
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.className = "toast-undo-button";
    undoButton.textContent = "Undo";
    undoButton.addEventListener("click", () => {
      undoHandler();
      hideToast();
    });
    elements.toast.appendChild(undoButton);
  }

  elements.toast.classList.add("visible");

  clearTimeout(elements.toast.timeoutId);
  elements.toast.timeoutId = setTimeout(() => {
    hideToast();
  }, 3200);
}

function resetFormState() {
  if (elements.form) {
    elements.form.reset();
  }

  state.editingSubjectId = null;
  updateAddButtonState();

  clearErrors();

  if (elements.subjectName) {
    elements.subjectName.focus();
  }
}

function findSubjectById(subjectId) {
  return state.subjects.find((subject) => String(subject.id) === String(subjectId));
}

function subjectNameExists(name, ignoreId = null) {
  const normalizedName = normalizeSubjectName(name).toLowerCase();

  return state.subjects.some((subject) => {
    const isSameId = ignoreId !== null && String(subject.id) === String(ignoreId);
    if (isSameId) {
      return false;
    }

    return normalizeSubjectName(subject.name).toLowerCase() === normalizedName;
  });
}

function createSubject() {
  const name = normalizeSubjectName(elements.subjectName.value);
  const credits = Number(elements.credits.value);
  const grade = elements.grade.value;

  return {
    id: Date.now() + Math.random(),
    name,
    credits,
    grade
  };
}

function addSubject() {
  if (!validateForm()) {
    return;
  }

  const subjectName = normalizeSubjectName(elements.subjectName.value);

  if (subjectNameExists(subjectName)) {
    setFieldError("subjectName", "This subject already exists in your list.");
    setStatusMessage("Duplicate subject detected. Please choose a different name.", "error");
    showToast("Duplicate subject detected");
    return;
  }

  const newSubject = createSubject();
  state.subjects.push(newSubject);

  renderSubjects();
  resetFormState();
  setStatusMessage("✓ Subject added successfully.", "info");
  showToast(`✓ ${newSubject.name} added successfully`);
}

function editSubject(subjectId) {
  const subject = findSubjectById(subjectId);

  if (!subject) {
    return;
  }

  state.editingSubjectId = subjectId;

  if (elements.subjectName) {
    elements.subjectName.value = subject.name;
  }

  if (elements.credits) {
    elements.credits.value = subject.credits;
  }

  if (elements.grade) {
    elements.grade.value = subject.grade;
  }

  clearErrors();
  updateAddButtonState();
  setStatusMessage(`Editing ${subject.name}. Update the details and save changes.`, "info");
  if (elements.subjectName) {
    elements.subjectName.focus();
  }
}

function updateSubject() {
  if (!state.editingSubjectId) {
    return;
  }

  if (!validateForm()) {
    return;
  }

  const subject = findSubjectById(state.editingSubjectId);
  if (!subject) {
    return;
  }

  const subjectName = normalizeSubjectName(elements.subjectName.value);

  if (subjectNameExists(subjectName, state.editingSubjectId)) {
    setFieldError("subjectName", "A subject with this name already exists.");
    setStatusMessage("You cannot duplicate an existing subject name.", "error");
    showToast("Duplicate subject name");
    return;
  }

  subject.name = subjectName;
  subject.credits = Number(elements.credits.value);
  subject.grade = elements.grade.value;

  renderSubjects();
  resetFormState();
  setStatusMessage("✓ Subject updated successfully.", "info");
  showToast(`✓ ${subjectName} updated successfully`);
}

function handleFormSubmit(event) {
  event.preventDefault();

  if (state.editingSubjectId !== null) {
    updateSubject();
    return;
  }

  addSubject();
}

function handleCalculateButton() {
  setStatusMessage("Add your subjects first. GPA calculation will be available soon.", "info");
}

function showModal(message, confirmButtonText, onConfirm) {
  if (!elements.modalOverlay || !elements.modalTitle || !elements.modalMessage || !elements.modalConfirmButton) {
    return;
  }

  elements.modalTitle.textContent = "Confirm Action";
  elements.modalMessage.textContent = message;
  elements.modalConfirmButton.textContent = confirmButtonText;
  elements.modalOverlay.classList.add("visible");
  elements.modalOverlay.setAttribute("aria-hidden", "false");

  const previousHandler = elements.modalConfirmButton.onclick;
  elements.modalConfirmButton.onclick = () => {
    if (typeof onConfirm === "function") {
      onConfirm();
    }
    hideModal();
  };

  if (previousHandler && previousHandler !== elements.modalConfirmButton.onclick) {
    // Placeholder to keep previous bindings isolated for this modal instance.
  }
}

function hideModal() {
  if (!elements.modalOverlay) {
    return;
  }

  elements.modalOverlay.classList.remove("visible");
  elements.modalOverlay.setAttribute("aria-hidden", "true");
  elements.modalConfirmButton.onclick = null;
}

function deleteSubject(subjectId) {
  const subject = findSubjectById(subjectId);
  if (!subject) {
    return;
  }

  state.pendingDeleteId = subjectId;
  showModal(`Are you sure you want to delete "${subject.name}"? This action cannot be undone unless you use the undo option in the toast.`, "Delete", () => {
    const subjectToDelete = findSubjectById(state.pendingDeleteId);
    if (!subjectToDelete) {
      state.pendingDeleteId = null;
      return;
    }

    const deletedSubject = { ...subjectToDelete };
    state.lastDeletedState = {
      type: "single",
      subject: deletedSubject
    };

    state.subjects = state.subjects.filter((item) => String(item.id) !== String(state.pendingDeleteId));
    state.pendingDeleteId = null;

    renderSubjects();
    setStatusMessage("✓ Subject deleted successfully.", "info");
    showToast(`✓ ${deletedSubject.name} deleted`, () => undoDelete());
  });
}

function deleteAllSubjects() {
  if (state.subjects.length === 0) {
    setStatusMessage("There are no subjects to delete.", "info");
    showToast("No subjects to delete");
    return;
  }

  state.pendingDeleteAll = true;
  showModal("Are you sure you want to delete all subjects? This action can be undone from the toast.", "Delete All", () => {
    state.lastDeletedState = {
      type: "all",
      subjects: [...state.subjects]
    };

    state.subjects = [];
    state.pendingDeleteAll = false;
    renderSubjects();
    resetFormState();
    setStatusMessage("✓ All subjects deleted successfully.", "info");
    showToast("✓ All subjects deleted", () => undoDelete());
  });
}

function undoDelete() {
  if (!state.lastDeletedState) {
    return;
  }

  if (state.lastDeletedState.type === "single") {
    state.subjects.push(state.lastDeletedState.subject);
  }

  if (state.lastDeletedState.type === "all") {
    state.subjects = [...state.lastDeletedState.subjects];
  }

  state.lastDeletedState = null;
  renderSubjects();
  setStatusMessage("✓ Last deletion restored.", "info");
}

function handleSubjectListClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const subjectId = actionButton.dataset.id;
  const action = actionButton.dataset.action;

  if (action === "edit") {
    editSubject(subjectId);
  }

  if (action === "delete") {
    deleteSubject(subjectId);
  }
}

function searchSubjects(value) {
  state.searchTerm = value;
  renderSubjects();
}

function sortList(value) {
  state.sortBy = value;
  renderSubjects();
}

function handleInputClear() {
  const error = document.getElementById(`${fieldId}Error`);
  if (error && error.textContent) {
    clearErrors();
  }
}

function setupEventListeners() {
  if (elements.form) {
    elements.form.addEventListener("submit", handleFormSubmit);
  }

  if (elements.calculateButton) {
    elements.calculateButton.addEventListener("click", handleCalculateButton);
  }

  if (elements.subjectList) {
    elements.subjectList.addEventListener("click", handleSubjectListClick);
  }

  if (elements.subjectSearch) {
    elements.subjectSearch.addEventListener("input", (event) => {
      searchSubjects(event.target.value);
    });
  }

  if (elements.subjectSort) {
    elements.subjectSort.addEventListener("change", (event) => {
      sortList(event.target.value);
    });
  }

  if (elements.deleteAllButton) {
    elements.deleteAllButton.addEventListener("click", deleteAllSubjects);
  }

  if (elements.cancelEditButton) {
    elements.cancelEditButton.addEventListener("click", resetFormState);
  }

  if (elements.modalCancelButton) {
    elements.modalCancelButton.addEventListener("click", hideModal);
  }

  ["subjectName", "credits", "grade"].forEach((fieldId) => {
    const field = document.getElementById(fieldId);

    if (!field) {
      return;
    }

    field.addEventListener("input", () => {
      const error = document.getElementById(`${fieldId}Error`);
      if (error && error.textContent) {
        clearErrors();
      }
    });

    field.addEventListener("blur", () => {
      const fieldValue = field.value;
      let errorMessage = "";

      if (fieldId === "subjectName") {
        errorMessage = validateSubjectName(fieldValue);
      }

      if (fieldId === "credits") {
        errorMessage = validateCredits(fieldValue);
      }

      if (fieldId === "grade") {
        errorMessage = validateGrade(fieldValue);
      }

      if (errorMessage) {
        setFieldError(fieldId, errorMessage);
      } else {
        clearFieldError(fieldId);
      }
    });
  });
}

function initializeApp() {
  updateAddButtonState();
  renderSubjects();
  setStatusMessage("Add your subject details to get started.", "info");
  setupEventListeners();
}

initializeApp();
