"use strict";

const GPA_CONFIG = {
  decimalPlaces: 2,
  minCredits: 1,
  maxCredits: 10
};

const GRADE_POINTS = {
  "A+": 10,
  A: 9,
  "B+": 8,
  B: 7,
  "C+": 6,
  C: 5,
  D: 4,
  F: 0
};

const state = {
  subjects: [],
  searchTerm: "",
  sortBy: "recent",
  editingSubjectId: null,
  lastDeletedState: null,
  pendingDeleteId: null,
  pendingDeleteAll: false,
  calculationValid: true
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
  totalQualityPointsValue: document.getElementById("totalQualityPointsValue"),
  gpaValue: document.getElementById("gpaValue"),
  gpaMeta: document.getElementById("gpaMeta"),
  calculationStatus: document.getElementById("calculationStatus"),
  calculationBreakdown: document.getElementById("calculationBreakdown"),
  gradeScale: document.getElementById("gradeScale"),
  toast: document.getElementById("toast"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalCancelButton: document.getElementById("modalCancelBtn"),
  modalConfirmButton: document.getElementById("modalConfirmBtn"),
  modalTitle: document.getElementById("modalTitle"),
  modalMessage: document.getElementById("modalMessage")
  ,
  analyticsGrid: document.getElementById("analyticsGrid"),
  gradeDistributionContainer: document.getElementById("gradeDistribution"),
  performanceInsightsContainer: document.getElementById("performanceInsights"),
  subjectPerformanceContainer: document.getElementById("subjectPerformance"),
  failedSubjectsContainer: document.getElementById("failedSubjects"),
  formulaExplanationContainer: document.getElementById("formulaExplanation")
  ,
  // Phase 7 controls
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  gradeFilter: document.getElementById("gradeFilter"),
  statusFilter: document.getElementById("statusFilter"),
  creditsFilter: document.getElementById("creditsFilter"),
  viewSort: document.getElementById("viewSort"),
  sortDirection: document.getElementById("sortDirection"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  resetViewBtn: document.getElementById("resetViewBtn"),
  resultCountText: document.getElementById("resultCountText"),
  activeFiltersContainer: document.getElementById("activeFilters")
};

/* -------------------- View State (Phase 7) -------------------- */
const viewState = {
  search: "",
  grade: "all",
  status: "all",
  credits: "all",
  sortBy: "original",
  sortDirection: "desc"
};

function formatSubjectCount(n) {
  return n === 1 ? "1 subject" : `${n} subjects`;
}

function isPassingGradeByValue(grade) {
  // Reuse existing grade mapping: everything except 'F' is passing
  if (!grade) return false;
  return String(grade) !== "F" && Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade);
}

/* -------------------- Display Pipeline -------------------- */
function applySearchFilter(list, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter((s) => String(s.name || "").toLowerCase().includes(q));
}

function applyGradeFilter(list, grade) {
  if (!grade || grade === "all") return list;
  return list.filter((s) => String(s.grade) === String(grade));
}

function applyStatusFilter(list, status) {
  if (!status || status === "all") return list;
  if (status === "passed") {
    return list.filter((s) => isPassingGradeByValue(s.grade));
  }
  if (status === "failed") {
    return list.filter((s) => String(s.grade) === "F");
  }
  return list;
}

function applyCreditsFilter(list, credits) {
  if (!credits || credits === "all") return list;
  const cnum = Number(credits);
  if (!Number.isFinite(cnum)) return list;
  return list.filter((s) => Number(s.credits) === cnum);
}

function applySort(list, sortBy, direction) {
  const dir = direction === "asc" ? 1 : -1;
  const copy = [...list];

  switch (sortBy) {
    case "name":
      return copy.sort((a, b) => dir * (String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase())));
    case "credits":
      return copy.sort((a, b) => dir * (Number(a.credits) - Number(b.credits)) || String(a.name).localeCompare(b.name));
    case "gradePoint":
      return copy.sort((a, b) => {
        const ag = getGradePoint(a.grade) ?? -999;
        const bg = getGradePoint(b.grade) ?? -999;
        return dir * (ag - bg) || String(a.name).localeCompare(b.name);
      });
    case "qualityPoints":
      return copy.sort((a, b) => {
        const aq = calculateQualityPoints(Number(a.credits) || 0, getGradePoint(a.grade) || 0);
        const bq = calculateQualityPoints(Number(b.credits) || 0, getGradePoint(b.grade) || 0);
        return dir * (aq - bq) || String(a.name).localeCompare(b.name);
      });
    case "original":
    default:
      return copy; // preserve original order from state.subjects copy
  }
}

function getDisplayedSubjects() {
  if (!Array.isArray(state.subjects)) return [];
  let result = [...state.subjects];
  result = applySearchFilter(result, viewState.search);
  result = applyGradeFilter(result, viewState.grade);
  result = applyStatusFilter(result, viewState.status);
  result = applyCreditsFilter(result, viewState.credits);
  result = applySort(result, viewState.sortBy, viewState.sortDirection);
  return result;
}

function updateCreditOptions() {
  if (!elements.creditsFilter) return;
  const unique = Array.from(new Set(state.subjects.map((s) => Number(s.credits)).filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);
  elements.creditsFilter.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All Credits";
  elements.creditsFilter.appendChild(optAll);
  unique.forEach((c) => {
    const o = document.createElement("option");
    o.value = String(c);
    o.textContent = `${c} Credit${c === 1 ? "" : "s"}`;
    elements.creditsFilter.appendChild(o);
  });
}

function renderActiveFilters() {
  if (!elements.activeFiltersContainer) return;
  const container = elements.activeFiltersContainer;
  container.innerHTML = "";
  const chips = [];
  if (viewState.search) chips.push({ label: `Search: "${viewState.search}"`, key: "search" });
  if (viewState.grade && viewState.grade !== "all") chips.push({ label: `Grade: ${viewState.grade}`, key: "grade" });
  if (viewState.status && viewState.status !== "all") chips.push({ label: `Status: ${viewState.status}`, key: "status" });
  if (viewState.credits && viewState.credits !== "all") chips.push({ label: `Credits: ${viewState.credits}`, key: "credits" });

  chips.forEach((c) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter-chip";
    chip.textContent = c.label + " ×";
    chip.addEventListener("click", () => {
      if (c.key === "search") {
        viewState.search = "";
        if (elements.subjectSearch) elements.subjectSearch.value = "";
      }
      if (c.key === "grade") {
        viewState.grade = "all";
        if (elements.gradeFilter) elements.gradeFilter.value = "all";
      }
      if (c.key === "status") {
        viewState.status = "all";
        if (elements.statusFilter) elements.statusFilter.value = "all";
      }
      if (c.key === "credits") {
        viewState.credits = "all";
        if (elements.creditsFilter) elements.creditsFilter.value = "all";
      }
      renderSubjects();
    });
    container.appendChild(chip);
  });
}

/* -------------------- Analytics Helpers (Phase 6) -------------------- */

function createEmptyGradeDistribution() {
  return {
    "A+": 0,
    A: 0,
    "B+": 0,
    B: 0,
    "C+": 0,
    C: 0,
    D: 0,
    F: 0
  };
}

function safePercentage(value, total) {
  const v = Number(value);
  const t = Number(total);
  if (!Number.isFinite(v) || !Number.isFinite(t) || t === 0) {
    return 0;
  }
  const pct = (v / t) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

const PERFORMANCE_THRESHOLDS = [
  { min: 9, label: "Excellent", description: "Your GPA is in the 9.00–10.00 range." },
  { min: 8, label: "Very Good", description: "Your GPA is in the 8.00–8.99 range." },
  { min: 7, label: "Good", description: "Your GPA is in the 7.00–7.99 range." },
  { min: 6, label: "Satisfactory", description: "Your GPA is in the 6.00–6.99 range." },
  { min: 5, label: "Needs Improvement", description: "Your GPA is in the 5.00–5.99 range." },
  { min: 0, label: "Needs Attention", description: "Your GPA is below 5.00." }
];

function getPerformanceLevel(gpa) {
  if (!Number.isFinite(gpa)) {
    return { label: "No Data", description: "No subjects available." };
  }

  for (const t of PERFORMANCE_THRESHOLDS) {
    if (gpa >= t.min) {
      return { label: t.label, description: t.description };
    }
  }

  return { label: "No Data", description: "No subjects available." };
}

function calculateAnalytics(subjects) {
  if (!Array.isArray(subjects)) {
    return null;
  }

  const subjectCount = subjects.length;
  const totalCredits = calculateTotalCredits(subjects);
  const totalQualityPoints = calculateTotalQualityPoints(subjects);
  const gpa = calculateGPA(subjects);

  // Average Grade Point (unweighted)
  const gradePoints = subjects.reduce((acc, s) => {
    const gp = getGradePoint(s.grade);
    return Number.isFinite(gp) ? acc + gp : acc;
  }, 0);

  const averageGradePoint = subjectCount === 0 ? 0 : gradePoints / subjectCount;

  // Pass / Fail
  const passedSubjects = subjects.filter((s) => {
    const gp = getGradePoint(s.grade);
    return gp !== null && String(s.grade) !== "F";
  }).length;

  const failedSubjects = subjects.filter((s) => String(s.grade) === "F").length;

  const passRate = safePercentage(passedSubjects, subjectCount);
  const failRate = safePercentage(failedSubjects, subjectCount);

  // Grade distribution
  const gradeDistribution = createEmptyGradeDistribution();
  subjects.forEach((s) => {
    if (Object.prototype.hasOwnProperty.call(gradeDistribution, s.grade)) {
      gradeDistribution[s.grade] += 1;
    }
  });

  // Highest / Lowest grade by grade point
  let highestGradePoint = -Infinity;
  let lowestGradePoint = Infinity;
  subjects.forEach((s) => {
    const gp = getGradePoint(s.grade);
    if (Number.isFinite(gp)) {
      highestGradePoint = Math.max(highestGradePoint, gp);
      lowestGradePoint = Math.min(lowestGradePoint, gp);
    }
  });

  const highestGrade = highestGradePoint === -Infinity ? null : Object.keys(GRADE_POINTS).find((k) => GRADE_POINTS[k] === highestGradePoint) || null;
  const lowestGrade = lowestGradePoint === Infinity ? null : Object.keys(GRADE_POINTS).find((k) => GRADE_POINTS[k] === lowestGradePoint) || null;

  // Highest credit subjects (may be ties)
  let maxCredits = -Infinity;
  subjects.forEach((s) => {
    const c = Number(s.credits);
    if (Number.isFinite(c)) {
      maxCredits = Math.max(maxCredits, c);
    }
  });
  const highestCreditSubjects = maxCredits === -Infinity ? [] : subjects.filter((s) => Number(s.credits) === maxCredits);

  // Highest quality point subjects
  let maxQuality = -Infinity;
  subjects.forEach((s) => {
    const gp = getGradePoint(s.grade);
    const q = Number.isFinite(gp) && Number.isFinite(Number(s.credits)) ? calculateQualityPoints(Number(s.credits), gp) : -Infinity;
    maxQuality = Math.max(maxQuality, q);
  });
  const highestQualitySubjects = maxQuality === -Infinity ? [] : subjects.filter((s) => {
    const gp = getGradePoint(s.grade);
    if (!Number.isFinite(gp)) return false;
    return calculateQualityPoints(Number(s.credits), gp) === maxQuality;
  });

  return {
    subjectCount,
    totalCredits,
    totalQualityPoints,
    gpa,
    averageGradePoint,
    passedSubjects,
    failedSubjects,
    passRate,
    failRate,
    gradeDistribution,
    highestGrade,
    lowestGrade,
    highestCreditSubjects,
    highestQualitySubjects
  };
}

function generatePerformanceInsights(analytics) {
  if (!analytics) return [];
  const insights = [];

  insights.push({ type: "gpa", text: `Your current GPA is ${formatGPA(analytics.gpa)}.` });
  insights.push({ type: "pass", text: `${analytics.passedSubjects} of ${analytics.subjectCount} subjects are passed.` });

  if (analytics.highestGrade) {
    insights.push({ type: "highest", text: `Highest grade: ${analytics.highestGrade}.` });
  }

  if (analytics.lowestGrade) {
    insights.push({ type: "lowest", text: `Lowest grade: ${analytics.lowestGrade}.` });
  }

  insights.push({ type: "average", text: `Average Grade Point: ${Number(analytics.averageGradePoint).toFixed(2)}.` });

  return insights.slice(0, 6);
}

/* -------------------- Analytics Rendering -------------------- */

function renderAnalytics(analytics) {
  if (!elements.analyticsGrid) return;

  elements.analyticsGrid.innerHTML = "";

  const createCard = (title, value, desc) => {
    const card = document.createElement("div");
    card.className = "analytics-card";
    card.innerHTML = `<div class='card-title'>${title}</div><div class='card-value'>${value}</div><div class='card-desc'>${desc || ""}</div>`;
    return card;
  };

  // GPA card (dominant)
  const perf = getPerformanceLevel(analytics.gpa);
  elements.analyticsGrid.appendChild(createCard("Current GPA", formatGPA(analytics.gpa), perf.label + (analytics.subjectCount ? ` • ${analytics.totalCredits} credits • ${analytics.subjectCount} subjects` : "")));

  elements.analyticsGrid.appendChild(createCard("Total Subjects", analytics.subjectCount, "Subjects entered"));
  elements.analyticsGrid.appendChild(createCard("Total Credits", analytics.totalCredits, "Across all subjects"));
  elements.analyticsGrid.appendChild(createCard("Average Grade Point", Number(analytics.averageGradePoint).toFixed(2), "Unweighted subject average"));
  elements.analyticsGrid.appendChild(createCard("Pass Rate", `${Math.round(analytics.passRate)}%`, `${analytics.passedSubjects} of ${analytics.subjectCount} passed`));
  elements.analyticsGrid.appendChild(createCard("Failed Subjects", analytics.failedSubjects, "Subjects with grade F"));

  renderGradeDistribution(analytics);
  renderPerformanceInsights(analytics);
  renderSubjectPerformance(analytics);
  renderFailedSubjects(analytics);
  renderFormulaExplanation(analytics);
}

function renderGradeDistribution(analytics) {
  if (!elements.gradeDistributionContainer) return;
  const container = elements.gradeDistributionContainer;
  container.innerHTML = "";

  const grades = ["A+", "A", "B+", "B", "C+", "C", "D", "F"];
  grades.forEach((grade) => {
    const count = analytics.gradeDistribution[grade] || 0;
    const pct = Math.round(safePercentage(count, analytics.subjectCount));

    const row = document.createElement("div");
    row.className = "grade-row";

    const label = document.createElement("div");
    label.className = "grade-label";
    label.textContent = grade;

    const barWrap = document.createElement("div");
    barWrap.className = "grade-bar";
    const fill = document.createElement("div");
    fill.className = "grade-bar-fill";
    fill.style.width = pct + "%";
    fill.setAttribute("role", "progressbar");
    fill.setAttribute("aria-valuemin", "0");
    fill.setAttribute("aria-valuemax", "100");
    fill.setAttribute("aria-valuenow", String(pct));
    barWrap.appendChild(fill);

    const countEl = document.createElement("div");
    countEl.className = "grade-count";
    countEl.textContent = String(count);

    const pctEl = document.createElement("div");
    pctEl.className = "grade-percentage";
    pctEl.textContent = `${pct}%`;

    row.append(label, barWrap, countEl, pctEl);
    container.appendChild(row);
  });
}

function renderPerformanceInsights(analytics) {
  if (!elements.performanceInsightsContainer) return;
  const container = elements.performanceInsightsContainer;
  container.innerHTML = "";

  const insights = generatePerformanceInsights(analytics);
  if (insights.length === 0) {
    const empty = document.createElement("div");
    empty.className = "insight-item";
    empty.textContent = "Add subjects to generate performance insights.";
    container.appendChild(empty);
    return;
  }

  insights.forEach((ins) => {
    const item = document.createElement("div");
    item.className = "insight-item";
    item.textContent = ins.text;
    container.appendChild(item);
  });
}

function renderSubjectPerformance(analytics) {
  if (!elements.subjectPerformanceContainer) return;
  const container = elements.subjectPerformanceContainer;
  container.innerHTML = "";

  if (!analytics || analytics.subjectCount === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<p>No subjects available.</p><span>Add subjects to view subject performance.</span>`;
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Subject</th>
        <th scope="col">Credits</th>
        <th scope="col">Grade</th>
        <th scope="col">Grade Point</th>
        <th scope="col">Quality Points</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  state.subjects.forEach((s) => {
    const gp = getGradePoint(s.grade) ?? 0;
    const qp = calculateQualityPoints(Number(s.credits) || 0, gp);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.credits}</td>
      <td>${s.grade}</td>
      <td>${gp}</td>
      <td>${qp}</td>
    `;
    tbody.appendChild(tr);
  });

  container.appendChild(table);
}

function renderFailedSubjects(analytics) {
  if (!elements.failedSubjectsContainer) return;
  const container = elements.failedSubjectsContainer;
  container.innerHTML = "";

  const failed = state.subjects.filter((s) => String(s.grade) === "F");
  if (failed.length === 0) {
    const msg = document.createElement("div");
    msg.className = "empty-state";
    msg.innerHTML = `<p>No subjects currently have an F grade.</p>`;
    container.appendChild(msg);
    return;
  }

  failed.forEach((s) => {
    const item = document.createElement("div");
    item.className = "failed-item";
    item.innerHTML = `<strong>${s.name}</strong><div>Grade: ${s.grade} • Credits: ${s.credits}</div>`;
    container.appendChild(item);
  });
}

function renderFormulaExplanation(analytics) {
  if (!elements.formulaExplanationContainer) return;
  const container = elements.formulaExplanationContainer;
  container.innerHTML = `
    <h4>How Your GPA Is Calculated</h4>
    <p>Total Quality Points: ${analytics.totalQualityPoints}</p>
    <p>Total Credits: ${analytics.totalCredits}</p>
    <p>GPA = Total Quality Points ÷ Total Credits</p>
    <p>Quality Points = Credits × Grade Point</p>
    <small>Performance labels are general indicators and may differ from your institution's official grading policy.</small>
  `;
}

function setStatusMessage(message, type = "info") {
  if (!elements.statusMessage) {
    return;
  }

  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `form-status ${type}`;
}

function formatGPA(value) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }

  return Number(value).toFixed(GPA_CONFIG.decimalPlaces);
}

function getGradePoint(grade) {
  if (!Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade)) {
    return null;
  }

  return GRADE_POINTS[grade];
}

function calculateQualityPoints(credits, gradePoint) {
  return Number(credits) * Number(gradePoint);
}

function calculateTotalCredits(subjects) {
  return subjects.reduce((total, subject) => {
    const numericCredits = Number(subject?.credits);

    if (!Number.isFinite(numericCredits) || numericCredits <= 0) {
      return total;
    }

    return total + numericCredits;
  }, 0);
}

function calculateTotalQualityPoints(subjects) {
  return subjects.reduce((total, subject) => {
    const gradePoint = getGradePoint(subject?.grade);
    const numericCredits = Number(subject?.credits);

    if (gradePoint === null || !Number.isFinite(numericCredits) || numericCredits <= 0) {
      return total;
    }

    return total + calculateQualityPoints(numericCredits, gradePoint);
  }, 0);
}

function calculateGPA(subjects) {
  const totalCredits = calculateTotalCredits(subjects);
  const totalQualityPoints = calculateTotalQualityPoints(subjects);

  if (totalCredits === 0) {
    return 0;
  }

  return totalQualityPoints / totalCredits;
}

function validateSubjectForCalculation(subject) {
  if (!subject || typeof subject.name !== "string") {
    return false;
  }

  if (subject.name.trim().length === 0) {
    return false;
  }

  if (!Number.isFinite(Number(subject.credits)) || Number(subject.credits) <= 0) {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(GRADE_POINTS, subject.grade)) {
    return false;
  }

  return true;
}

function validateSubjectsForCalculation(subjects) {
  if (!Array.isArray(subjects)) {
    return false;
  }

  if (subjects.length === 0) {
    return true;
  }

  return subjects.every(validateSubjectForCalculation);
}

function calculateResults(subjects) {
  if (!Array.isArray(subjects)) {
    return {
      valid: false,
      totalCredits: 0,
      totalQualityPoints: 0,
      gpa: null,
      breakdown: []
    };
  }

  if (subjects.length === 0) {
    return {
      valid: true,
      totalCredits: 0,
      totalQualityPoints: 0,
      gpa: 0,
      breakdown: []
    };
  }

  if (!validateSubjectsForCalculation(subjects)) {
    return {
      valid: false,
      totalCredits: 0,
      totalQualityPoints: 0,
      gpa: null,
      breakdown: []
    };
  }

  const totalCredits = calculateTotalCredits(subjects);
  const totalQualityPoints = calculateTotalQualityPoints(subjects);
  const gpa = calculateGPA(subjects);

  const breakdown = subjects.map((subject, index) => {
    const gradePoint = getGradePoint(subject.grade);
    const qualityPoints = calculateQualityPoints(Number(subject.credits), gradePoint);

    return {
      id: subject.id,
      no: index + 1,
      name: subject.name,
      credits: Number(subject.credits),
      grade: subject.grade,
      gradePoint,
      qualityPoints
    };
  });

  return {
    valid: true,
    totalCredits,
    totalQualityPoints,
    gpa,
    breakdown
  };
}

function renderGradeScale() {
  if (!elements.gradeScale) {
    return;
  }

  const entries = Object.entries(GRADE_POINTS)
    .slice()
    .sort((left, right) => {
      return Number(right[1]) - Number(left[1]);
    });

  elements.gradeScale.innerHTML = "";

  entries.forEach(([grade, gradePoint]) => {
    const item = document.createElement("div");
    item.className = "grade-item";

    const label = document.createElement("span");
    label.className = "grade-label";
    label.textContent = `${grade}`;

    const point = document.createElement("span");
    point.className = "grade-point";
    point.textContent = String(gradePoint);

    item.append(label, point);
    elements.gradeScale.appendChild(item);
  });
}

function renderCalculationBreakdown(results) {
  if (!elements.calculationBreakdown) {
    return;
  }

  elements.calculationBreakdown.innerHTML = "";

  if (!results.valid) {
    const invalidState = document.createElement("div");
    invalidState.className = "calculation-invalid-state";

    const title = document.createElement("strong");
    title.textContent = "Complete all subject details before calculating GPA.";

    const message = document.createElement("span");
    message.textContent = "Each subject must have a valid name, credit value, and grade.";

    invalidState.append(title, message);
    elements.calculationBreakdown.appendChild(invalidState);
    return;
  }

  if (results.breakdown.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "calculation-empty-state";

    const title = document.createElement("strong");
    title.textContent = "No subjects available for calculation.";

    const message = document.createElement("span");
    message.textContent = "Add subjects above to calculate your GPA.";

    emptyState.append(title, message);
    elements.calculationBreakdown.appendChild(emptyState);
    return;
  }

  const table = document.createElement("table");
  table.className = "calculation-table";

  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">No.</th>
        <th scope="col">Subject</th>
        <th scope="col" class="numeric">Credits</th>
        <th scope="col" class="numeric">Grade</th>
        <th scope="col" class="numeric">Grade Point</th>
        <th scope="col" class="numeric">Quality Points</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  results.breakdown.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.no}</td>
      <td>${entry.name}</td>
      <td class="numeric">${entry.credits}</td>
      <td class="numeric">${entry.grade}</td>
      <td class="numeric">${entry.gradePoint}</td>
      <td class="numeric">${entry.qualityPoints}</td>
    `;
    tbody.appendChild(row);
  });

  const totalsRow = document.createElement("tr");
  totalsRow.innerHTML = `
    <td colspan="2"><strong>Total</strong></td>
    <td class="numeric"><strong>${results.totalCredits}</strong></td>
    <td class="numeric"><strong>—</strong></td>
    <td class="numeric"><strong>—</strong></td>
    <td class="numeric"><strong>${results.totalQualityPoints}</strong></td>
  `;
  tbody.appendChild(totalsRow);

  elements.calculationBreakdown.appendChild(table);

  const mobileList = document.createElement("div");
  mobileList.className = "calculation-mobile-list";

  results.breakdown.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "breakdown-card";

    const title = document.createElement("strong");
    title.textContent = entry.name;

    const details = document.createElement("p");
    details.textContent = `Credits: ${entry.credits} | Grade: ${entry.grade} | Grade Point: ${entry.gradePoint} | Quality Points: ${entry.qualityPoints}`;

    card.append(title, details);
    mobileList.appendChild(card);
  });

  elements.calculationBreakdown.appendChild(mobileList);
}

function renderResults(results) {
  const totalSubjects = state.subjects.length;
  const totalCredits = Number(results.totalCredits || 0);
  const totalQualityPoints = Number(results.totalQualityPoints || 0);

  if (elements.totalSubjectsValue) {
    elements.totalSubjectsValue.textContent = String(totalSubjects);
  }

  if (elements.totalCreditsValue) {
    elements.totalCreditsValue.textContent = String(totalCredits);
  }

  if (elements.totalQualityPointsValue) {
    elements.totalQualityPointsValue.textContent = String(totalQualityPoints);
  }

  if (elements.gpaValue) {
    if (!results.valid || results.gpa === null) {
      elements.gpaValue.textContent = "—";
    } else {
      elements.gpaValue.textContent = formatGPA(results.gpa);
    }
  }

  if (elements.gpaMeta) {
    if (totalSubjects === 0) {
      elements.gpaMeta.textContent = "No subjects available";
    } else if (!results.valid || results.gpa === null) {
      elements.gpaMeta.textContent = "Complete all subject details";
    } else {
      elements.gpaMeta.textContent = `Calculated from ${totalSubjects} subject${totalSubjects === 1 ? "" : "s"}`;
    }
  }

  if (elements.calculationStatus) {
    if (totalSubjects === 0) {
      elements.calculationStatus.textContent = "No subjects available for calculation.";
    } else if (!results.valid || results.gpa === null) {
      elements.calculationStatus.textContent = "Complete all subject details to calculate GPA.";
    } else {
      elements.calculationStatus.textContent = `Total Quality Points = ${results.totalQualityPoints}; Total Credits = ${results.totalCredits}; GPA = ${formatGPA(results.gpa)}.`;
    }
  }

  renderCalculationBreakdown(results);
}

function updateCalculator() {
  const results = calculateResults(state.subjects);
  state.calculationValid = results.valid;
  renderResults(results);
  // Analytics refresh (Phase 6)
  const analytics = calculateAnalytics(state.subjects);
  if (analytics) {
    renderAnalytics(analytics);
  }
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
function updateSummary() {
  const totalSubjects = state.subjects.length;
  const totalCredits = calculateTotalCredits(state.subjects);

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
  // Backwards-compatible alias for the Phase 7 display pipeline
  return getDisplayedSubjects();
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
  const visibleSubjects = getDisplayedSubjects();
  elements.subjectList.innerHTML = "";
  if (visibleSubjects.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-subject-list";

    const title = document.createElement("strong");
    // Distinguish between no subjects and no matches/filters
    const totalSubjects = state.subjects.length;
    if (totalSubjects === 0) {
      title.textContent = "No subjects added yet";
    } else if (viewState.search && !viewState.grade && !viewState.status && !viewState.credits) {
      title.textContent = "No matching subjects found";
    } else if (viewState.search || viewState.grade !== "all" || viewState.status !== "all" || viewState.credits !== "all") {
      title.textContent = "No subjects match the selected filters";
    } else {
      title.textContent = "No subjects available";
    }

    const message = document.createElement("span");
    if (totalSubjects === 0) {
      message.textContent = "Add your first subject using the form above.";
    } else {
      message.textContent = "Try adjusting your search or clearing filters.";
    }

    emptyState.appendChild(title);
    emptyState.appendChild(message);
    elements.subjectList.appendChild(emptyState);
    updateSummary();
    // update result count and active filters
    if (elements.resultCountText) {
      elements.resultCountText.textContent = `Showing 0 of ${totalSubjects} subjects`;
    }
    renderActiveFilters();
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
  // update result count and active filters
  if (elements.resultCountText) {
    elements.resultCountText.textContent = `Showing ${visibleSubjects.length} of ${state.subjects.length} subjects`;
  }
  renderActiveFilters();
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
  updateCalculator();
  updateCreditOptions();
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
  updateCalculator();
  updateCreditOptions();
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
    updateCalculator();
    updateCreditOptions();
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
    updateCalculator();
    resetFormState();
    updateCreditOptions();
    resetView();
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
  updateCalculator();
  updateCreditOptions();
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
  viewState.search = value;
  if (elements.subjectSearch) elements.subjectSearch.value = value;
  renderSubjects();
}

function sortList(value) {
  viewState.sortBy = value;
  if (elements.viewSort) elements.viewSort.value = value;
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
    elements.calculateButton.addEventListener("click", () => {
      updateCalculator();
      setStatusMessage("GPA updated successfully.", "info");
    });
  }

  if (elements.subjectList) {
    elements.subjectList.addEventListener("click", handleSubjectListClick);
  }

  // Phase 7: Search & controls
  if (elements.subjectSearch) {
    elements.subjectSearch.addEventListener("input", (event) => {
      viewState.search = event.target.value;
      if (elements.clearSearchBtn) {
        elements.clearSearchBtn.style.display = viewState.search ? "inline-block" : "none";
      }
      renderSubjects();
    });
  }

  if (elements.clearSearchBtn) {
    elements.clearSearchBtn.addEventListener("click", () => {
      viewState.search = "";
      if (elements.subjectSearch) elements.subjectSearch.value = "";
      elements.clearSearchBtn.style.display = "none";
      renderSubjects();
    });
  }

  if (elements.gradeFilter) {
    elements.gradeFilter.addEventListener("change", (e) => {
      viewState.grade = e.target.value;
      renderSubjects();
    });
  }

  if (elements.statusFilter) {
    elements.statusFilter.addEventListener("change", (e) => {
      viewState.status = e.target.value;
      renderSubjects();
    });
  }

  if (elements.creditsFilter) {
    elements.creditsFilter.addEventListener("change", (e) => {
      viewState.credits = e.target.value;
      renderSubjects();
    });
  }

  if (elements.viewSort) {
    elements.viewSort.addEventListener("change", (e) => {
      viewState.sortBy = e.target.value;
      renderSubjects();
    });
  }

  if (elements.sortDirection) {
    elements.sortDirection.addEventListener("change", (e) => {
      viewState.sortDirection = e.target.value;
      renderSubjects();
    });
  }

  if (elements.clearFiltersBtn) {
    elements.clearFiltersBtn.addEventListener("click", () => {
      // Clear dropdown filters but keep search
      viewState.grade = "all";
      viewState.status = "all";
      viewState.credits = "all";
      if (elements.gradeFilter) elements.gradeFilter.value = "all";
      if (elements.statusFilter) elements.statusFilter.value = "all";
      if (elements.creditsFilter) elements.creditsFilter.value = "all";
      renderSubjects();
    });
  }

  if (elements.resetViewBtn) {
    elements.resetViewBtn.addEventListener("click", () => {
      resetView();
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
  renderGradeScale();
  updateAddButtonState();
  renderSubjects();
  updateCalculator();
  updateCreditOptions();
  setStatusMessage("Add your subject details to get started.", "info");
  setupEventListeners();
}

initializeApp();

function resetView() {
  viewState.search = "";
  viewState.grade = "all";
  viewState.status = "all";
  viewState.credits = "all";
  viewState.sortBy = "original";
  viewState.sortDirection = "desc";
  if (elements.subjectSearch) elements.subjectSearch.value = "";
  if (elements.gradeFilter) elements.gradeFilter.value = "all";
  if (elements.statusFilter) elements.statusFilter.value = "all";
  if (elements.creditsFilter) elements.creditsFilter.value = "all";
  if (elements.viewSort) elements.viewSort.value = "original";
  if (elements.sortDirection) elements.sortDirection.value = "desc";
  if (elements.clearSearchBtn) elements.clearSearchBtn.style.display = "none";
  renderSubjects();
}
