const STORAGE_KEY = "content-planner-tasks-v3";
const CARRYOVER_KEY = "content-planner-carryover-last-date";
const PROFILE_KEY = "content-planner-profile-v1";

const defaultProfileConfig = {
  name: "",
  role: "Social Media Manager",
  groups: [
    { name: "Videography / Multimedia", categories: ["Video Shoot", "video editing"] },
    { name: "Graphic Design", categories: ["Post Designing", "Thumbnail Designing", "Print Media Design"] },
    { name: "Marketing & Operations", categories: ["social media publishing", "Leads Data entry", "COD order Processing"] },
    { name: "Web & Tech", categories: ["Website Development"] },
    { name: "General", categories: ["In between tasks", "Other Tasks"] },
  ],
};
const pipelineStages = ["Idea", "Shoot", "Edit", "Review", "Post", "Completed"];

const categoryColors = {
  "Video Shoot": "#f43f5e",
  "video editing": "#8b5cf6",
  "Post Designing": "#3b82f6",
  "Thumbnail Designing": "#ec4899",
  "Print Media Design": "#f97316",
  "Leads Data entry": "#06b6d4",
  "COD order Processing": "#eab308",
  "Website Development": "#22c55e",
  "In between tasks": "#94a3b8",
  "Other Tasks": "#64748b",
  "social media publishing": "#ef4444",
};

const categoryChecklistTemplates = {
  "Website Development": ["Add/Edit Product", "Product SEO", "Fix Prices"],
  "social media publishing": ["📝 CONTENT WRITING", "▶️ Youtube", "📸 Insta", "📘 FB", "🎵 Tiktok", "💼 Linkedin"],
};

const priorities = [
  { value: "high", label: "🔴 High" },
  { value: "medium", label: "🟠 Medium" },
  { value: "low", label: "🟢 Low" },
];

const state = {
  cursorDate: new Date(),
  tasksByDate: loadTasks(),
  modalDateKey: null,
  editingTaskId: null,
  detailRef: null,
  reminders: new Set(),
  pomodoroTimer: null,
  pomodoroSecondsLeft: 25 * 60,
  activeView: "dashboard",
  selectedPipelineGroup: "all",
  profileConfig: loadProfileConfig(),
};

const monthLabel = document.getElementById("monthLabel");
const todayDateLabel = document.getElementById("todayDateLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekdayRow = document.getElementById("weekdayRow");
const pipelineBoard = document.getElementById("pipelineBoard");
const tooltip = document.getElementById("taskTooltip");

const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskModalTitle = document.getElementById("taskModalTitle");
const taskText = document.getElementById("taskText");
const taskDescription = document.getElementById("taskDescription");
const taskStatus = document.getElementById("taskStatus");
const taskStage = document.getElementById("taskStage");
const taskReminder = document.getElementById("taskReminder");
const taskPomodoro = document.getElementById("taskPomodoro");
const taskCategory = document.getElementById("taskCategory");
const taskPriority = document.getElementById("taskPriority");
const categoryOptions = document.getElementById("categoryOptions");
const modalSubtaskInput = document.getElementById("modalSubtaskInput");
const modalSubtaskList = document.getElementById("modalSubtaskList");

const quickAddForm = document.getElementById("quickAddForm");
const quickTaskText = document.getElementById("quickTaskText");
const quickTaskDate = document.getElementById("quickTaskDate");
const quickTaskCategory = document.getElementById("quickTaskCategory");
const quickTaskPriority = document.getElementById("quickTaskPriority");

const dayTasksModal = document.getElementById("dayTasksModal");
const dayTasksTitle = document.getElementById("dayTasksTitle");
const dayTasksList = document.getElementById("dayTasksList");

const taskDetailsModal = document.getElementById("taskDetailsModal");
const taskDetailsTitle = document.getElementById("taskDetailsTitle");
const taskDetailsBody = document.getElementById("taskDetailsBody");
const detailEditBtn = document.getElementById("detailEditBtn");
const detailDeleteBtn = document.getElementById("detailDeleteBtn");
const pomodoroDisplay = document.getElementById("pomodoroDisplay");
const subtaskList = document.getElementById("subtaskList");
const newSubtaskInput = document.getElementById("newSubtaskInput");

const viewMode = document.getElementById("viewMode");
const dateFilterWrap = document.getElementById("dateFilterWrap");
const weekFilterWrap = document.getElementById("weekFilterWrap");
const filterDate = document.getElementById("filterDate");
const filterWeek = document.getElementById("filterWeek");
const filteredTasks = document.getElementById("filteredTasks");

const notificationCenter = document.getElementById("notificationCenter");
const notificationList = document.getElementById("notificationList");
const searchInput = document.getElementById("searchInput");
const topBar = document.getElementById("topBar");
const topSearchWrap = document.getElementById("topSearchWrap");
const profileChip = document.getElementById("profileChip");
const todayFocusToggle = document.getElementById("todayFocusToggle");
const pipelineGroupFilters = document.getElementById("pipelineGroupFilters");
const profileForm = document.getElementById("profileForm");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const addGroupForm = document.getElementById("addGroupForm");
const addCategoryForm = document.getElementById("addCategoryForm");
const newGroupName = document.getElementById("newGroupName");
const parentGroupSelect = document.getElementById("parentGroupSelect");
const newCategoryName = document.getElementById("newCategoryName");
const groupList = document.getElementById("groupList");

let modalDraftSubtasks = [];

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}
function loadProfileConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (!parsed?.groups?.length) return JSON.parse(JSON.stringify(defaultProfileConfig));
    return parsed;
  } catch {
    return JSON.parse(JSON.stringify(defaultProfileConfig));
  }
}
function saveProfileConfig() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profileConfig));
}
function allCategories() {
  return state.profileConfig.groups.flatMap((group) => group.categories);
}
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasksByDate));
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}
function safeUUID() {
  return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function getCategoryColor(category) {
  if (categoryColors[category]) return categoryColors[category];
  const palette = ["#60a5fa", "#f472b6", "#f59e0b", "#22d3ee", "#a78bfa", "#34d399"];
  const idx = Math.abs([...category].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % palette.length;
  return palette[idx];
}
function shadeColor(hex, opacity = 0.18) {
  const value = hex.replace("#", "");
  return `rgba(${parseInt(value.substring(0, 2), 16)}, ${parseInt(value.substring(2, 4), 16)}, ${parseInt(value.substring(4, 6), 16)}, ${opacity})`;
}
function sortedTasks(tasks) {
  return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));
}
function emojiPriority(priority) {
  return priority === "high" ? "🔴 High" : priority === "medium" ? "🟠 Medium" : "🟢 Low";
}

function setupSelects() {
  const categoryOptionsHtml = allCategories().map((c) => `<option value="${c}">${c}</option>`).join("");
  const priorityOptions = priorities.map((p) => `<option value="${p.value}">${p.label}</option>`).join("");
  [taskCategory, quickTaskCategory].forEach((select) => (select.innerHTML = categoryOptionsHtml));
  [taskPriority, quickTaskPriority].forEach((select) => (select.innerHTML = priorityOptions));
}

function renderWeekdays() {
  weekdayRow.innerHTML = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div>${day}</div>`).join("");
}

function carryForwardIncompleteTasks() {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const lastProcessedKey = localStorage.getItem(CARRYOVER_KEY);
  let cursor = lastProcessedKey ? parseDateKey(lastProcessedKey) : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  while (formatDateKey(cursor) < todayKey) {
    const fromKey = formatDateKey(cursor);
    const toDate = new Date(cursor);
    toDate.setDate(toDate.getDate() + 1);
    const toKey = formatDateKey(toDate);

    const prevTasks = state.tasksByDate[fromKey] || [];
    const nextDayTasks = state.tasksByDate[toKey] || [];
    prevTasks.filter((task) => !task.completed).forEach((task) => {
      const exists = nextDayTasks.some((t) => t.carriedFromDate === fromKey && t.carriedFromTaskId === task.id);
      if (!exists) nextDayTasks.push({ ...task, id: safeUUID(), carriedFromDate: fromKey, carriedFromTaskId: task.id });
    });
    state.tasksByDate[toKey] = nextDayTasks;
    cursor = toDate;
  }

  localStorage.setItem(CARRYOVER_KEY, todayKey);
  saveTasks();
}

function isOverdue(task, dateKey) {
  return !task.completed && parseDateKey(dateKey) < parseDateKey(formatDateKey(new Date()));
}

function subtaskProgress(task) {
  const total = (task.subtasks || []).length;
  const done = (task.subtasks || []).filter((s) => s.done).length;
  return { done, total };
}

function taskMatchesSearch(task, q) {
  if (!q) return true;
  const hay = [task.text, task.category, task.description, ...(task.subtasks || []).map((s) => s.title)].join(" ").toLowerCase();
  return hay.includes(q);
}

function renderCalendar(searchQuery = "") {
  const year = state.cursorDate.getFullYear();
  const month = state.cursorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  monthLabel.textContent = firstDay.toLocaleString("en-US", { month: "long", year: "numeric" });
  calendarGrid.innerHTML = "";

  for (let i = 0; i < totalCells; i += 1) {
    const date = new Date(year, month, i - startOffset + 1);
    const dateKey = formatDateKey(date);
    const dayTasksRaw = sortedTasks(state.tasksByDate[dateKey] || []);
    const dayTasks = dayTasksRaw.filter((t) => taskMatchesSearch(t, searchQuery));
    const isCurrentMonth = date.getMonth() === month;

    const cell = document.createElement("article");
    cell.className = `day-cell${isCurrentMonth ? "" : " outside"}${dateKey === formatDateKey(new Date()) ? " today" : ""}`;
    cell.dataset.dateKey = dateKey;
    cell.innerHTML = `<div class="day-head"><strong>${date.getDate()}</strong><button type="button" data-add="${dateKey}" title="Add task">+ Task</button></div><small>${date.toLocaleString("en-US", { weekday: "short" })}</small><ul class="task-list" data-day-list="${dateKey}"></ul>`;

    const listEl = cell.querySelector(".task-list");
    listEl.addEventListener("dragover", (event) => { event.preventDefault(); listEl.style.background = shadeColor("#38bdf8", 0.18); });
    listEl.addEventListener("dragleave", () => { listEl.style.background = ""; });
    listEl.addEventListener("drop", (event) => {
      event.preventDefault();
      listEl.style.background = "";
      const raw = event.dataTransfer.getData("text/plain");
      if (!raw) return;
      const { fromDateKey, taskId } = JSON.parse(raw);
      moveTask(fromDateKey, dateKey, taskId);
    });

    dayTasks.forEach((task) => listEl.appendChild(createTaskElement(task, dateKey)));
    calendarGrid.appendChild(cell);
  }

  renderTodayFocusPanel();
  renderSummary();
  renderFilteredTasks();
  renderPipelineTimeline();
  renderNotifications();
  checkReminders();
}

function createTaskElement(task, dateKey) {
  const li = document.createElement("li");
  const categoryColor = getCategoryColor(task.category);
  const p = subtaskProgress(task);

  li.className = `task-item priority-${task.priority}${isOverdue(task, dateKey) ? " overdue" : ""}${dateKey === formatDateKey(new Date()) ? " today-task" : ""}`;
  li.draggable = true;
  li.style.background = `linear-gradient(110deg, ${shadeColor(categoryColor, 0.32)} 0%, transparent 90%)`;

  li.addEventListener("dragstart", (event) => {
    li.classList.add("dragging");
    event.dataTransfer.setData("text/plain", JSON.stringify({ fromDateKey: dateKey, taskId: task.id }));
  });
  li.addEventListener("dragend", () => li.classList.remove("dragging"));

  const carryInfo = task.carriedFromDate ? `<span class="pill">↪ ${task.carriedFromDate}</span>` : "";
  const warn = isOverdue(task, dateKey) ? "⚠️" : "";
  li.innerHTML = `
    <div class="task-main"><button type="button" class="check-toggle ${task.completed ? "done" : ""}" data-toggle="${task.id}" aria-label="Toggle complete"><span class="check-icon">✓</span></button><span class="task-title ${task.completed ? "done" : ""}">${warn} ${task.text}</span></div>
    <div class="task-meta"><span class="pill" style="background:${shadeColor(categoryColor, 0.45)}">${task.category}</span><span class="pill priority-pill ${task.priority}">${emojiPriority(task.priority)}</span><span class="pill">${task.stage || "Idea"}</span>${carryInfo}<span class="sub-progress">◔ ${p.done}/${p.total || 0}</span></div>
    <div class="task-actions"><button type="button" data-view="${task.id}">View</button><button type="button" data-edit="${task.id}">Edit</button><button type="button" data-delete="${task.id}">Delete</button></div>
    <div class="task-hover-actions"><button type="button" data-edit-icon="${task.id}" title="Edit">✏️</button><button type="button" data-delete-icon="${task.id}" title="Delete">🗑️</button></div>
  `;

  li.dataset.tooltip = JSON.stringify({
    title: task.text,
    description: task.description || "No description",
    category: task.category,
    stage: task.stage || "Idea",
    sub: `${p.done}/${p.total || 0}`,
  });
  li.addEventListener("mouseenter", showTooltip);
  li.addEventListener("mousemove", moveTooltip);
  li.addEventListener("mouseleave", hideTooltip);

  li.querySelector(`[data-toggle="${task.id}"]`).addEventListener("click", (event) => { event.stopPropagation(); toggleTask(dateKey, task.id); });
  li.querySelector(`[data-view="${task.id}"]`).addEventListener("click", () => openTaskDetails(dateKey, task.id));
  li.querySelector(`[data-edit="${task.id}"]`).addEventListener("click", () => openTaskModal(dateKey, task));
  li.querySelector(`[data-delete="${task.id}"]`).addEventListener("click", () => deleteTask(dateKey, task.id));
  li.querySelector(`[data-edit-icon="${task.id}"]`).addEventListener("click", (event) => { event.stopPropagation(); openTaskModal(dateKey, task); });
  li.querySelector(`[data-delete-icon="${task.id}"]`).addEventListener("click", (event) => { event.stopPropagation(); deleteTask(dateKey, task.id); });

  // Click anywhere on task chip to open details (except checkbox/action controls)
  li.addEventListener("click", (event) => {
    if (event.target.closest('.check-toggle') || event.target.closest('button')) return;
    openTaskDetails(dateKey, task.id);
  });

  return li;
}

function showTooltip(e) {
  try {
    const t = JSON.parse(e.currentTarget.dataset.tooltip);
    tooltip.innerHTML = `<strong>${t.title}</strong><br/>${t.description}<br/><small>Category: ${t.category}</small><br/><small>Stage: ${t.stage}</small><br/><small>Subtasks: ${t.sub}</small>`;
    tooltip.classList.remove("hidden");
  } catch {}
}
function moveTooltip(e) {
  tooltip.style.left = `${e.clientX + 14}px`;
  tooltip.style.top = `${e.clientY + 14}px`;
}
function hideTooltip() {
  tooltip.classList.add("hidden");
}

function renderCategoryOptions(selectedCategory, existingChecks = []) {
  const items = categoryChecklistTemplates[selectedCategory] || [];
  if (!items.length) {
    categoryOptions.innerHTML = "";
    categoryOptions.classList.add("hidden");
    return;
  }
  categoryOptions.classList.remove("hidden");
  categoryOptions.innerHTML = `<h4>${selectedCategory} checklist</h4><div class="checkbox-grid">${items.map((i) => `<label><input type="checkbox" value="${i}" data-cat-check ${existingChecks.includes(i) ? "checked" : ""}/> ${i}</label>`).join("")}</div>`;
}

function openTaskModal(dateKey, task = null) {
  state.modalDateKey = dateKey;
  state.editingTaskId = task?.id || null;
  taskModalTitle.textContent = task ? "Edit Task" : "Add Task";

  taskCategory.value = task?.category || allCategories()[0];
  renderCategoryOptions(taskCategory.value, task?.categoryChecklist || []);
  taskText.value = task?.text || "";
  taskDescription.value = task?.description || "";
  taskStatus.value = task?.status || "Not Started";
  taskStage.value = task?.stage || "Idea";
  taskReminder.value = task?.reminder || "";
  taskPomodoro.value = task?.pomodoroMinutes || 25;
  taskPriority.value = task?.priority || "medium";
  modalDraftSubtasks = (task?.subtasks || []).map((s) => ({ id: s.id || safeUUID(), title: s.title, done: Boolean(s.done) }));
  renderModalSubtaskList();
  taskModal.showModal();
}

function collectTaskPayload() {
  const categoryChecklist = [...categoryOptions.querySelectorAll("[data-cat-check]:checked")].map((el) => el.value);
  return {
    text: taskText.value.trim(),
    description: taskDescription.value.trim(),
    status: taskStatus.value,
    stage: taskStage.value,
    reminder: taskReminder.value,
    pomodoroMinutes: Number(taskPomodoro.value) || 25,
    category: taskCategory.value,
    priority: taskPriority.value,
    subtasks: modalDraftSubtasks,
    categoryChecklist,
  };
}

function addOrUpdateTask(dateKey, payload, taskId = null) {
  const tasks = state.tasksByDate[dateKey] || [];
  state.tasksByDate[dateKey] = taskId
    ? tasks.map((task) => (task.id === taskId ? { ...task, ...payload } : task))
    : [...tasks, { id: safeUUID(), completed: false, ...payload }];
  saveTasks();
  renderCalendar(searchInput.value.toLowerCase().trim());
}
function deleteTask(dateKey, taskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).filter((task) => task.id !== taskId);
  saveTasks();
  renderCalendar(searchInput.value.toLowerCase().trim());
}

function toggleTask(dateKey, taskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    const completed = !task.completed;
    return {
      ...task,
      completed,
      stage: completed ? "Completed" : task.stage === "Completed" ? "Idea" : task.stage,
      status: completed ? "Done" : task.status === "Done" ? "In Progress" : task.status,
    };
  });
  saveTasks();
  renderCalendar(searchInput.value.toLowerCase().trim());
}

function moveTask(fromDateKey, toDateKey, taskId) {
  if (fromDateKey === toDateKey) return;
  const fromTasks = state.tasksByDate[fromDateKey] || [];
  const movingTask = fromTasks.find((task) => task.id === taskId);
  if (!movingTask) return;
  state.tasksByDate[fromDateKey] = fromTasks.filter((task) => task.id !== taskId);
  state.tasksByDate[toDateKey] = [...(state.tasksByDate[toDateKey] || []), movingTask];
  saveTasks();
  renderCalendar(searchInput.value.toLowerCase().trim());
}

function renderSummary() {
  const all = Object.values(state.tasksByDate).flat();
  const todayKey = formatDateKey(new Date());
  const allPending = all.filter((task) => !task.completed);
  document.getElementById("dueTodayCount").textContent = (state.tasksByDate[todayKey] || []).length;
  document.getElementById("highPriorityCount").textContent = all.filter((t) => t.priority === "high" && !t.completed).length;
  document.getElementById("pendingCount").textContent = allPending.length;
  document.getElementById("completedCount").textContent = all.filter((t) => t.completed).length;
}

function renderTodayFocusPanel() {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const mode = todayFocusToggle.checked ? "month" : "today";
  let tasksWithDates = [];

  if (mode === "month") {
    const y = today.getFullYear();
    const m = today.getMonth();
    tasksWithDates = Object.entries(state.tasksByDate).flatMap(([dateKey, tasks]) => {
      const d = parseDateKey(dateKey);
      if (d.getFullYear() !== y || d.getMonth() !== m) return [];
      return tasks.map((task) => ({ ...task, dateKey }));
    });
    todayDateLabel.textContent = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } else {
    tasksWithDates = sortedTasks(state.tasksByDate[todayKey] || []).map((task) => ({ ...task, dateKey: todayKey }));
    todayDateLabel.textContent = parseDateKey(todayKey).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }
  const tasks = sortedTasks(tasksWithDates);

  const groups = {
    high: tasks.filter((t) => t.priority === "high" && !t.completed),
    medium: tasks.filter((t) => t.priority === "medium" && !t.completed),
    low: tasks.filter((t) => t.priority === "low" && !t.completed),
    done: tasks.filter((t) => t.completed),
  };

  const map = [["high", "High Impact"], ["medium", "Medium"], ["low", "Low"], ["done", "Done"]];
  document.getElementById("todayFocusBoard").innerHTML = map
    .map(([key, title]) => `<section class="kanban-column" data-kanban-col="${key}"><h3>${title}</h3><ul>${renderKanbanCards(groups[key])}</ul></section>`)
    .join("");

  document.querySelectorAll(".kanban-task").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", JSON.stringify({ dateKey: card.dataset.dateKey, taskId: card.dataset.taskId }));
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });

  document.querySelectorAll("[data-kanban-col]").forEach((col) => {
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload.taskId || !payload.dateKey) return;
      updateTodayTaskByColumn(payload.dateKey, payload.taskId, col.dataset.kanbanCol);
    });
  });
}

function renderKanbanCards(tasks) {
  if (!tasks.length) return `<li class="pill">No tasks</li>`;
  return tasks.map((task) => {
    const c = getCategoryColor(task.category);
    const dateTag = todayFocusToggle.checked ? `<small>${task.dateKey}</small>` : "";
    return `<li class="kanban-task" draggable="true" data-task-id="${task.id}" data-date-key="${task.dateKey}" style="background:${shadeColor(c, 0.35)};border-color:${shadeColor(c, 0.75)}"><span class="task-title ${task.completed ? "done" : ""}">${task.text}</span>${dateTag}</li>`;
  }).join("");
}

function updateTodayTaskByColumn(todayKey, taskId, column) {
  state.tasksByDate[todayKey] = (state.tasksByDate[todayKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    if (column === "done") return { ...task, completed: true, status: "Done", stage: "Completed" };
    return { ...task, completed: false, status: task.status === "Done" ? "In Progress" : task.status, priority: column };
  });
  saveTasks();
  renderCalendar(searchInput.value.toLowerCase().trim());
}

function renderPipelineTimeline() {
  const selectedGroup = state.selectedPipelineGroup;
  const allowedCategories = selectedGroup === "all"
    ? null
    : new Set((state.profileConfig.groups.find((group) => group.name === selectedGroup)?.categories || []));
  const allTasks = Object.entries(state.tasksByDate).flatMap(([dateKey, tasks]) =>
    tasks
      .filter((task) => !allowedCategories || allowedCategories.has(task.category))
      .map((task) => ({ ...task, dateKey, effectiveStage: task.completed ? "Completed" : (task.stage || "Idea") }))
  );
  pipelineBoard.innerHTML = pipelineStages.map((stage) => {
    const stageTasks = allTasks.filter((task) => task.effectiveStage === stage);
    return `<section class="pipeline-col" data-stage="${stage}"><h4>${stage} (${stageTasks.length})</h4><ul>${stageTasks.map((task) => `<li class="pipeline-chip" draggable="true" data-date-key="${task.dateKey}" data-task-id="${task.id}">${task.text}</li>`).join("") || `<li class="pill">No tasks</li>`}</ul></section>`;
  }).join("");

  pipelineBoard.querySelectorAll(".pipeline-chip").forEach((chip) => {
    chip.addEventListener("dragstart", (e) => {
      chip.classList.add("dragging");
      e.dataTransfer.setData("text/plain", JSON.stringify({ dateKey: chip.dataset.dateKey, taskId: chip.dataset.taskId }));
    });
    chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
  });

  pipelineBoard.querySelectorAll(".pipeline-col").forEach((col) => {
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;
      const payload = JSON.parse(raw);
      updateTaskStage(payload.dateKey, payload.taskId, col.dataset.stage);
    });
  });
}

function updateTaskStage(dateKey, taskId, stage) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) =>
    task.id === taskId ? {
      ...task,
      category: stage === "Edit" && task.category === "Video Shoot" ? "video editing" : task.category,
      stage,
      completed: stage === "Completed" ? true : task.completed,
      status: stage === "Completed" ? "Done" : task.status,
    } : task
  );
  saveTasks();
  renderCalendar(searchInput.value.toLowerCase().trim());
}

function renderPipelineGroupFilters() {
  pipelineGroupFilters.innerHTML = [
    `<button type="button" class="toggle-chip ${state.selectedPipelineGroup === "all" ? "active" : ""}" data-pipe-group="all">All</button>`,
    ...state.profileConfig.groups.map((group) => `<button type="button" class="toggle-chip ${state.selectedPipelineGroup === group.name ? "active" : ""}" data-pipe-group="${group.name}">${group.name}</button>`),
  ].join("");

  pipelineGroupFilters.querySelectorAll("[data-pipe-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedPipelineGroup = btn.dataset.pipeGroup;
      renderPipelineGroupFilters();
      renderPipelineTimeline();
    });
  });
}

function renderSettingsProfile() {
  profileName.value = state.profileConfig.name || "";
  profileRole.value = state.profileConfig.role || "Social Media Manager";
  profileChip.textContent = `${state.profileConfig.name || "Guest"} • ${state.profileConfig.role || "Social Media Manager"}`;
  parentGroupSelect.innerHTML = state.profileConfig.groups.map((group) => `<option value="${group.name}">${group.name}</option>`).join("");
  groupList.innerHTML = state.profileConfig.groups.map((group) => `
    <article class="group-card">
      <h4>${group.name}</h4>
      <div class="group-tags">${group.categories.map((category) => `<span class="pill">${category}</span>`).join("")}</div>
    </article>
  `).join("");
}

function openDayTasksModal(dateKey) {
  const tasks = sortedTasks(state.tasksByDate[dateKey] || []);
  dayTasksTitle.textContent = `Tasks for ${parseDateKey(dateKey).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  dayTasksList.innerHTML = tasks.length ? tasks.map((t) => `<li><strong>${t.text}</strong><br/><small>${t.status} • ${emojiPriority(t.priority)} • ${t.category}</small></li>`).join("") : "<li>No tasks for this day.</li>";
  dayTasksModal.showModal();
}

function openTaskDetails(dateKey, taskId) {
  const task = (state.tasksByDate[dateKey] || []).find((i) => i.id === taskId);
  if (!task) return;
  state.detailRef = { dateKey, taskId };
  state.pomodoroSecondsLeft = (task.pomodoroMinutes || 25) * 60;
  renderPomodoroDisplay();

  taskDetailsTitle.textContent = task.text;
  taskDetailsBody.innerHTML = `
    <p><strong>Description:</strong> ${task.description || "No description"}</p>
    <p><strong>Status:</strong> ${task.status || "Not Started"}</p>
    <p><strong>Category:</strong> ${task.category}</p>
    <p><strong>Priority:</strong> ${emojiPriority(task.priority)}</p>
    <p><strong>Stage:</strong> ${task.stage || "Idea"}</p>
    <p><strong>Reminder:</strong> ${task.reminder ? new Date(task.reminder).toLocaleString() : "No reminder"}</p>
    ${task.categoryChecklist?.length ? `<p><strong>Category checklist:</strong> ${task.categoryChecklist.join(", ")}</p>` : ""}
  `;

  renderSubtaskList(task);
  detailEditBtn.onclick = () => openTaskModal(dateKey, task);
  detailDeleteBtn.onclick = () => {
    taskDetailsModal.close();
    deleteTask(dateKey, taskId);
  };
  taskDetailsModal.showModal();
}

function renderSubtaskList(task) {
  subtaskList.innerHTML = (task.subtasks || []).length
    ? task.subtasks.map((s) => `
      <li class="subtask-item">
        <div class="subtask-main">
          <button type="button" class="check-toggle ${s.done ? "done" : ""}" data-sub-id="${s.id}" aria-label="Toggle subtask">
            <span class="check-icon">✓</span>
          </button>
          <span class="task-title ${s.done ? "done" : ""}">${s.title}</span>
        </div>
        <button type="button" data-sub-del="${s.id}">✕</button>
      </li>`).join("")
    : `<li class="pill">No subtasks</li>`;

  subtaskList.querySelectorAll("[data-sub-id]").forEach((el) => {
    el.addEventListener("click", (e) => toggleSubtask(state.detailRef.dateKey, state.detailRef.taskId, e.currentTarget.dataset.subId));
  });
  subtaskList.querySelectorAll("[data-sub-del]").forEach((el) => {
    el.addEventListener("click", (e) => deleteSubtask(state.detailRef.dateKey, state.detailRef.taskId, e.target.dataset.subDel));
  });
}

function addSubtaskFromInput() {
  const text = newSubtaskInput.value.trim();
  if (!text || !state.detailRef) return;

  state.tasksByDate[state.detailRef.dateKey] = (state.tasksByDate[state.detailRef.dateKey] || []).map((task) => {
    if (task.id !== state.detailRef.taskId) return task;
    return { ...task, subtasks: [...(task.subtasks || []), { id: safeUUID(), title: text, done: false }] };
  });

  newSubtaskInput.value = "";
  saveTasks();
  openTaskDetails(state.detailRef.dateKey, state.detailRef.taskId);
  renderCalendar(searchInput.value.toLowerCase().trim());
}

function toggleSubtask(dateKey, taskId, subtaskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    return { ...task, subtasks: (task.subtasks || []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)) };
  });
  saveTasks();
  openTaskDetails(dateKey, taskId);
  renderCalendar(searchInput.value.toLowerCase().trim());
}

function deleteSubtask(dateKey, taskId, subtaskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    return { ...task, subtasks: (task.subtasks || []).filter((s) => s.id !== subtaskId) };
  });
  saveTasks();
  openTaskDetails(dateKey, taskId);
  renderCalendar(searchInput.value.toLowerCase().trim());
}

function renderModalSubtaskList() {
  modalSubtaskList.innerHTML = modalDraftSubtasks.length
    ? modalDraftSubtasks.map((s) => `
      <li class="subtask-item">
        <div class="subtask-main">
          <button type="button" class="check-toggle ${s.done ? "done" : ""}" data-modal-sub-toggle="${s.id}" aria-label="Toggle subtask">
            <span class="check-icon">✓</span>
          </button>
          <span class="task-title ${s.done ? "done" : ""}">${s.title}</span>
        </div>
        <button type="button" data-modal-sub-del="${s.id}">✕</button>
      </li>
    `).join("")
    : `<li class="pill">No subtasks</li>`;

  modalSubtaskList.querySelectorAll("[data-modal-sub-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalDraftSubtasks = modalDraftSubtasks.map((s) => (s.id === btn.dataset.modalSubToggle ? { ...s, done: !s.done } : s));
      renderModalSubtaskList();
    });
  });
  modalSubtaskList.querySelectorAll("[data-modal-sub-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalDraftSubtasks = modalDraftSubtasks.filter((s) => s.id !== btn.dataset.modalSubDel);
      renderModalSubtaskList();
    });
  });
}

function addModalSubtaskFromInput() {
  const title = modalSubtaskInput.value.trim();
  if (!title) return;
  modalDraftSubtasks = [...modalDraftSubtasks, { id: safeUUID(), title, done: false }];
  modalSubtaskInput.value = "";
  renderModalSubtaskList();
}

function renderPomodoroDisplay() {
  const min = String(Math.floor(state.pomodoroSecondsLeft / 60)).padStart(2, "0");
  const sec = String(state.pomodoroSecondsLeft % 60).padStart(2, "0");
  pomodoroDisplay.textContent = `${min}:${sec}`;
}

function startPomodoro() {
  if (state.pomodoroTimer) clearInterval(state.pomodoroTimer);
  state.pomodoroTimer = setInterval(() => {
    state.pomodoroSecondsLeft -= 1;
    renderPomodoroDisplay();
    if (state.pomodoroSecondsLeft <= 0) {
      clearInterval(state.pomodoroTimer);
      state.pomodoroTimer = null;
      alert("Pomodoro complete! Time for a short break.");
    }
  }, 1000);
}

function checkReminders() {
  const now = Date.now();
  Object.entries(state.tasksByDate).forEach(([dateKey, tasks]) => {
    tasks.forEach((task) => {
      if (!task.reminder) return;
      const key = `${dateKey}-${task.id}`;
      const ts = new Date(task.reminder).getTime();
      if (!Number.isNaN(ts) && ts <= now && !state.reminders.has(key)) {
        state.reminders.add(key);
        alert(`Reminder: ${task.text}`);
      }
    });
  });
}

function weekRangeFromWeekInput(weekValue) {
  const [year, week] = weekValue.split("-W").map(Number);
  if (!year || !week) return null;
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - ((dow + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function renderFilteredTasks() {
  const mode = viewMode.value;
  const items = [];
  if (mode === "date" && filterDate.value) {
    sortedTasks(state.tasksByDate[filterDate.value] || []).forEach((task) => items.push(`<li>${task.text} <small>(${task.status || "Not Started"})</small></li>`));
  }
  if (mode === "week" && filterWeek.value) {
    const range = weekRangeFromWeekInput(filterWeek.value);
    if (range) {
      Object.entries(state.tasksByDate).forEach(([dateKey, tasks]) => {
        const date = parseDateKey(dateKey);
        if (date >= range.start && date <= range.end) {
          sortedTasks(tasks).forEach((task) => items.push(`<li>${dateKey}: ${task.text} <small>(${task.status || "Not Started"})</small></li>`));
        }
      });
    }
  }
  filteredTasks.innerHTML = items.length ? items.join("") : "<li>No tasks in selected filter.</li>";
}

function setViewModeUI() {
  const isDate = viewMode.value === "date";
  dateFilterWrap.classList.toggle("hidden", !isDate);
  weekFilterWrap.classList.toggle("hidden", isDate);
  renderFilteredTasks();
}

function renderNotifications() {
  const todayKey = formatDateKey(new Date());
  const all = Object.entries(state.tasksByDate).flatMap(([dateKey, tasks]) => tasks.map((task) => ({ ...task, dateKey })));
  const dueToday = all.filter((t) => t.dateKey === todayKey && !t.completed);
  const overdue = all.filter((t) => !t.completed && parseDateKey(t.dateKey) < parseDateKey(todayKey));
  const milestones = all.filter((t) => t.completed && t.stage === "Completed");
  const notes = [
    ...dueToday.map((t) => `📌 Due today: ${t.text}`),
    ...overdue.map((t) => `⚠️ Overdue: ${t.text} (${t.dateKey})`),
    ...milestones.slice(-5).map((t) => `✅ Milestone completed: ${t.text}`),
  ];
  notificationList.innerHTML = notes.length ? notes.map((n) => `<li>${n}</li>`).join("") : `<li>No notifications right now.</li>`;
}

function setActiveView(view) {
  state.activeView = view;
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  topBar.classList.toggle("hidden", view === "settings");
  topSearchWrap.classList.remove("hidden");

  document.querySelectorAll(".view-section").forEach((section) => {
    const allowedViews = section.dataset.section.split(" ");
    section.classList.toggle("hidden", !allowedViews.includes(view));
  });
}

// Events

document.getElementById("prevMonth").addEventListener("click", () => {
  state.cursorDate.setMonth(state.cursorDate.getMonth() - 1);
  renderCalendar(searchInput.value.toLowerCase().trim());
});
document.getElementById("nextMonth").addEventListener("click", () => {
  state.cursorDate.setMonth(state.cursorDate.getMonth() + 1);
  renderCalendar(searchInput.value.toLowerCase().trim());
});
document.getElementById("todayBtn").addEventListener("click", () => {
  state.cursorDate = new Date();
  renderCalendar(searchInput.value.toLowerCase().trim());
});

document.getElementById("themeToggle").addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
});

document.getElementById("notificationBtn").addEventListener("click", () => notificationCenter.classList.toggle("hidden"));
document.getElementById("closeNotifications").addEventListener("click", () => notificationCenter.classList.add("hidden"));

document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => setActiveView(btn.dataset.view));
});

document.getElementById("jumpTodaySetting").addEventListener("click", () => {
  state.cursorDate = new Date();
  setActiveView("calendar");
  renderCalendar(searchInput.value.toLowerCase().trim());
});
document.getElementById("openNotificationSetting").addEventListener("click", () => notificationCenter.classList.remove("hidden"));
document.getElementById("clearSearchSetting").addEventListener("click", () => {
  searchInput.value = "";
  renderCalendar();
});
profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.profileConfig.name = profileName.value.trim();
  state.profileConfig.role = profileRole.value;
  saveProfileConfig();
  renderSettingsProfile();
});
addGroupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const groupName = newGroupName.value.trim();
  if (!groupName) return;
  if (state.profileConfig.groups.some((group) => group.name.toLowerCase() === groupName.toLowerCase())) return;
  state.profileConfig.groups.push({ name: groupName, categories: [] });
  newGroupName.value = "";
  saveProfileConfig();
  setupSelects();
  renderSettingsProfile();
  renderPipelineGroupFilters();
  renderCalendar(searchInput.value.toLowerCase().trim());
});
addCategoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const parentName = parentGroupSelect.value;
  const categoryName = newCategoryName.value.trim();
  if (!parentName || !categoryName) return;
  const parent = state.profileConfig.groups.find((group) => group.name === parentName);
  if (!parent) return;
  if (!parent.categories.some((category) => category.toLowerCase() === categoryName.toLowerCase())) {
    parent.categories.push(categoryName);
  }
  newCategoryName.value = "";
  saveProfileConfig();
  setupSelects();
  renderSettingsProfile();
  renderPipelineGroupFilters();
  renderCalendar(searchInput.value.toLowerCase().trim());
});

taskCategory.addEventListener("change", () => renderCategoryOptions(taskCategory.value));

calendarGrid.addEventListener("click", (event) => {
  const addBtn = event.target.closest("button[data-add]");
  if (addBtn) return openTaskModal(addBtn.dataset.add);
  const cell = event.target.closest(".day-cell");
  if (cell && !event.target.closest(".task-item")) openDayTasksModal(cell.dataset.dateKey);
});

quickAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addOrUpdateTask(quickTaskDate.value, {
    text: quickTaskText.value.trim(),
    description: "",
    status: "Not Started",
    stage: "Idea",
    reminder: "",
    pomodoroMinutes: 25,
    category: quickTaskCategory.value,
    priority: quickTaskPriority.value,
    subtasks: [],
    categoryChecklist: [],
  });
  quickAddForm.reset();
  quickTaskDate.value = formatDateKey(new Date());
  quickTaskCategory.value = allCategories()[0];
  quickTaskPriority.value = "medium";
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addOrUpdateTask(state.modalDateKey, collectTaskPayload(), state.editingTaskId || null);
  state.editingTaskId = null;
  taskModal.close();
});

document.getElementById("cancelTaskBtn").addEventListener("click", () => { state.editingTaskId = null; taskModal.close(); });
document.getElementById("closeDayTasks").addEventListener("click", () => dayTasksModal.close());
document.getElementById("closeTaskDetails").addEventListener("click", () => taskDetailsModal.close());
document.getElementById("startPomodoro").addEventListener("click", startPomodoro);
document.getElementById("addSubtaskBtn").addEventListener("click", addSubtaskFromInput);
document.getElementById("addModalSubtaskBtn").addEventListener("click", addModalSubtaskFromInput);
newSubtaskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addSubtaskFromInput();
  }
});
modalSubtaskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addModalSubtaskFromInput();
  }
});

viewMode.addEventListener("change", setViewModeUI);
filterDate.addEventListener("change", renderFilteredTasks);
filterWeek.addEventListener("change", renderFilteredTasks);
todayFocusToggle.addEventListener("change", renderTodayFocusPanel);

searchInput.addEventListener("input", (e) => renderCalendar(e.target.value.toLowerCase().trim()));

document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
  if (e.key.toLowerCase() === "n") {
    e.preventDefault();
    openTaskModal(formatDateKey(new Date()));
  }
  if (e.key.toLowerCase() === "f") {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key.toLowerCase() === "t") {
    e.preventDefault();
    state.cursorDate = new Date();
    renderCalendar(searchInput.value.toLowerCase().trim());
  }
});

function init() {
  setupSelects();
  carryForwardIncompleteTasks();
  renderWeekdays();
  quickTaskDate.value = formatDateKey(new Date());
  filterDate.value = formatDateKey(new Date());
  quickTaskCategory.value = allCategories()[0];
  quickTaskPriority.value = "medium";
  todayFocusToggle.checked = false;
  renderCategoryOptions(taskCategory.value || allCategories()[0]);
  renderSettingsProfile();
  renderPipelineGroupFilters();
  setViewModeUI();
  setActiveView("dashboard");
  renderCalendar();
  setInterval(checkReminders, 30000);
}

init();
