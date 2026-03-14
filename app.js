const STORAGE_KEY = "content-planner-tasks-v3";
const CARRYOVER_KEY = "content-planner-carryover-last-date";

const categories = [
  "Video Shoot",
  "video editing",
  "Post Designing",
  "Thumbnail Designing",
  "Leads Data entry",
  "COD order Processing",
  "Website Development",
  "In between tasks",
  "social media publishing",
];

const categoryColors = {
  "Video Shoot": "#fef3c7",
  "video editing": "#ddd6fe",
  "Post Designing": "#dbeafe",
  "Thumbnail Designing": "#fecdd3",
  "Leads Data entry": "#cffafe",
  "COD order Processing": "#fde68a",
  "Website Development": "#dcfce7",
  "In between tasks": "#e5e7eb",
  "social media publishing": "#fee2e2",
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
};

const monthLabel = document.getElementById("monthLabel");
const todayDateLabel = document.getElementById("todayDateLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekdayRow = document.getElementById("weekdayRow");
const analyticsPanel = document.getElementById("analyticsPanel");

const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskModalTitle = document.getElementById("taskModalTitle");
const taskText = document.getElementById("taskText");
const taskDescription = document.getElementById("taskDescription");
const taskStatus = document.getElementById("taskStatus");
const taskReminder = document.getElementById("taskReminder");
const taskPomodoro = document.getElementById("taskPomodoro");
const taskCategory = document.getElementById("taskCategory");
const taskPriority = document.getElementById("taskPriority");
const taskSubtasks = document.getElementById("taskSubtasks");
const categoryOptions = document.getElementById("categoryOptions");

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
const pomodoroDisplay = document.getElementById("pomodoroDisplay");
const subtaskList = document.getElementById("subtaskList");
const newSubtaskInput = document.getElementById("newSubtaskInput");

const viewMode = document.getElementById("viewMode");
const dateFilterWrap = document.getElementById("dateFilterWrap");
const weekFilterWrap = document.getElementById("weekFilterWrap");
const filterDate = document.getElementById("filterDate");
const filterWeek = document.getElementById("filterWeek");
const filteredTasks = document.getElementById("filteredTasks");

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasksByDate)); }
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseDateKey(dateKey) { return new Date(`${dateKey}T00:00:00`); }
function safeUUID() { return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function getCategoryColor(category) { return categoryColors[category] || "#e2e8f0"; }
function getPriorityColor(priority) { return priority === "high" ? "#ef4444" : priority === "medium" ? "#f97316" : "#22c55e"; }
function shadeColor(hex, opacity = 0.18) {
  const value = hex.replace("#", "");
  return `rgba(${parseInt(value.substring(0,2),16)}, ${parseInt(value.substring(2,4),16)}, ${parseInt(value.substring(4,6),16)}, ${opacity})`;
}

function setupSelects() {
  const categoryOptionsHtml = categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  const priorityOptions = priorities.map((p) => `<option value="${p.value}">${p.label}</option>`).join("");
  [taskCategory, quickTaskCategory].forEach((select) => (select.innerHTML = categoryOptionsHtml));
  [taskPriority, quickTaskPriority].forEach((select) => (select.innerHTML = priorityOptions));
}

function renderWeekdays() {
  weekdayRow.innerHTML = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div>${day}</div>`).join("");
}

function sortedTasks(tasks) { return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed)); }
function emojiPriority(priority) { return priority === "high" ? "🔴 High" : priority === "medium" ? "🟠 Medium" : "🟢 Low"; }

function carryForwardIncompleteTasks() {
  const todayKey = formatDateKey(new Date());
  if (localStorage.getItem(CARRYOVER_KEY) === todayKey) return;

  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterdayKey = formatDateKey(y);
  const prevTasks = state.tasksByDate[yesterdayKey] || [];
  const todayTasks = state.tasksByDate[todayKey] || [];

  prevTasks.filter((task) => !task.completed).forEach((task) => {
    const exists = todayTasks.some((t) => t.carriedFromDate === yesterdayKey && t.carriedFromTaskId === task.id);
    if (!exists) {
      todayTasks.push({ ...task, id: safeUUID(), carriedFromDate: yesterdayKey, carriedFromTaskId: task.id });
    }
  });

  state.tasksByDate[todayKey] = todayTasks;
  localStorage.setItem(CARRYOVER_KEY, todayKey);
  saveTasks();
}

function renderCalendar() {
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
    const dayTasks = sortedTasks(state.tasksByDate[dateKey] || []);
    const isCurrentMonth = date.getMonth() === month;

    const cell = document.createElement("article");
    cell.className = `day-cell${isCurrentMonth ? "" : " outside"}${dateKey === formatDateKey(new Date()) ? " today" : ""}`;
    cell.dataset.dateKey = dateKey;
    cell.innerHTML = `
      <div class="day-head"><strong>${date.getDate()}</strong><button type="button" data-add="${dateKey}" title="Add task">+ Task</button></div>
      <small>${date.toLocaleString("en-US", { weekday: "short" })}</small>
      <ul class="task-list" data-day-list="${dateKey}"></ul>
    `;

    const listEl = cell.querySelector(".task-list");
    listEl.addEventListener("dragover", (event) => { event.preventDefault(); listEl.style.background = shadeColor("#38bdf8", .18); });
    listEl.addEventListener("dragleave", () => { listEl.style.background = ""; });
    listEl.addEventListener("drop", (event) => {
      event.preventDefault(); listEl.style.background = "";
      const raw = event.dataTransfer.getData("text/plain"); if (!raw) return;
      const { fromDateKey, taskId } = JSON.parse(raw);
      moveTask(fromDateKey, dateKey, taskId);
    });

    dayTasks.forEach((task) => listEl.appendChild(createTaskElement(task, dateKey)));
    calendarGrid.appendChild(cell);
  }

  renderTodayFocusPanel();
  renderSummary();
  renderFilteredTasks();
  renderAnalytics();
  checkReminders();
}

function createTaskElement(task, dateKey) {
  const li = document.createElement("li");
  li.className = "task-item";
  li.draggable = true;
  const categoryColor = getCategoryColor(task.category);
  li.style.background = `linear-gradient(110deg, ${shadeColor(categoryColor, 0.32)} 0%, transparent 90%)`;
  li.style.borderLeftColor = getPriorityColor(task.priority);

  li.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", JSON.stringify({ fromDateKey: dateKey, taskId: task.id }));
  });

  const carryInfo = task.carriedFromDate ? `<span class="pill">↪ ${task.carriedFromDate}</span>` : "";
  li.innerHTML = `
    <div class="task-main"><input type="checkbox" data-toggle="${task.id}" ${task.completed ? "checked" : ""} /><span class="task-title ${task.completed ? "done" : ""}">${task.text}</span></div>
    <div class="task-meta">
      <span class="pill" style="background:${shadeColor(categoryColor, .45)}">${task.category}</span>
      <span class="pill priority-pill ${task.priority}">${emojiPriority(task.priority)}</span>
      ${carryInfo}
    </div>
    <div class="task-actions"><button type="button" data-view="${task.id}">View</button><button type="button" data-edit="${task.id}">Edit</button><button type="button" data-delete="${task.id}">Delete</button></div>
  `;

  li.querySelector(`[data-toggle="${task.id}"]`).addEventListener("change", () => toggleTask(dateKey, task.id));
  li.querySelector(`[data-view="${task.id}"]`).addEventListener("click", () => openTaskDetails(dateKey, task.id));
  li.querySelector(`[data-edit="${task.id}"]`).addEventListener("click", () => openTaskModal(dateKey, task));
  li.querySelector(`[data-delete="${task.id}"]`).addEventListener("click", () => deleteTask(dateKey, task.id));
  return li;
}

function renderCategoryOptions(selectedCategory, existingChecks = []) {
  const items = categoryChecklistTemplates[selectedCategory] || [];
  if (!items.length) { categoryOptions.innerHTML = ""; categoryOptions.classList.add("hidden"); return; }
  categoryOptions.classList.remove("hidden");
  categoryOptions.innerHTML = `<h4>${selectedCategory} checklist</h4><div class="checkbox-grid">${items.map((i) => `<label><input type="checkbox" value="${i}" data-cat-check ${existingChecks.includes(i) ? "checked" : ""}/> ${i}</label>`).join("")}</div>`;
}

function openTaskModal(dateKey, task = null) {
  state.modalDateKey = dateKey;
  state.editingTaskId = task?.id || null;
  taskModalTitle.textContent = task ? "Edit Task" : "Add Task";
  taskCategory.value = task?.category || categories[0];
  renderCategoryOptions(taskCategory.value, task?.categoryChecklist || []);
  taskText.value = task?.text || "";
  taskDescription.value = task?.description || "";
  taskStatus.value = task?.status || "Not Started";
  taskReminder.value = task?.reminder || "";
  taskPomodoro.value = task?.pomodoroMinutes || 25;
  taskPriority.value = task?.priority || "medium";
  taskSubtasks.value = task?.subtasks?.map((s) => s.title).join("\n") || "";
  taskModal.showModal();
}

function collectTaskPayload() {
  const subtaskTitles = taskSubtasks.value.split("\n").map((s) => s.trim()).filter(Boolean);
  const existing = (state.tasksByDate[state.modalDateKey] || []).find((task) => task.id === state.editingTaskId);
  const subtasks = subtaskTitles.map((title) => existing?.subtasks?.find((s) => s.title === title) || { id: safeUUID(), title, done: false });
  const categoryChecklist = [...categoryOptions.querySelectorAll("[data-cat-check]:checked")].map((el) => el.value);
  return {
    text: taskText.value.trim(), description: taskDescription.value.trim(), status: taskStatus.value,
    reminder: taskReminder.value, pomodoroMinutes: Number(taskPomodoro.value) || 25,
    category: taskCategory.value, priority: taskPriority.value, subtasks, categoryChecklist,
  };
}

function addOrUpdateTask(dateKey, payload, taskId = null) {
  const tasks = state.tasksByDate[dateKey] || [];
  state.tasksByDate[dateKey] = taskId
    ? tasks.map((task) => (task.id === taskId ? { ...task, ...payload } : task))
    : [...tasks, { id: safeUUID(), completed: false, ...payload }];
  saveTasks();
  renderCalendar();
}

function deleteTask(dateKey, taskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).filter((t) => t.id !== taskId);
  saveTasks();
  renderCalendar();
}

function toggleTask(dateKey, taskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    const completed = !task.completed;
    return { ...task, completed, status: completed ? "Done" : task.status === "Done" ? "In Progress" : task.status };
  });
  saveTasks();
  renderCalendar();
}

function moveTask(fromDateKey, toDateKey, taskId) {
  if (fromDateKey === toDateKey) return;
  const fromTasks = state.tasksByDate[fromDateKey] || [];
  const movingTask = fromTasks.find((task) => task.id === taskId);
  if (!movingTask) return;
  state.tasksByDate[fromDateKey] = fromTasks.filter((task) => task.id !== taskId);
  state.tasksByDate[toDateKey] = [...(state.tasksByDate[toDateKey] || []), movingTask];
  saveTasks();
  renderCalendar();
}

function renderSummary() {
  const all = Object.values(state.tasksByDate).flat();
  const todayKey = formatDateKey(new Date());
  document.getElementById("dueTodayCount").textContent = (state.tasksByDate[todayKey] || []).length;
  document.getElementById("highPriorityCount").textContent = all.filter((t) => t.priority === "high" && !t.completed).length;
  document.getElementById("completedCount").textContent = all.filter((t) => t.completed).length;
}

function renderTodayFocusPanel() {
  const todayKey = formatDateKey(new Date());
  const tasks = sortedTasks(state.tasksByDate[todayKey] || []);
  todayDateLabel.textContent = parseDateKey(todayKey).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const groups = {
    high: tasks.filter((t) => t.priority === "high" && !t.completed),
    medium: tasks.filter((t) => t.priority === "medium" && !t.completed),
    low: tasks.filter((t) => t.priority === "low" && !t.completed),
    done: tasks.filter((t) => t.completed),
  };

  const map = [
    ["high", "High Impact"],
    ["medium", "Medium"],
    ["low", "Low"],
    ["done", "Done"],
  ];

  document.getElementById("todayFocusBoard").innerHTML = map
    .map(([key, title]) => `<section class="kanban-column" data-kanban-col="${key}"><h3>${title}</h3><ul>${renderKanbanCards(groups[key], todayKey)}</ul></section>`)
    .join("");

  document.querySelectorAll(".kanban-task").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ dateKey: todayKey, taskId: card.dataset.taskId }));
    });
  });

  document.querySelectorAll("[data-kanban-col]").forEach((col) => {
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload.taskId || payload.dateKey !== todayKey) return;
      updateTodayTaskByColumn(todayKey, payload.taskId, col.dataset.kanbanCol);
    });
  });
}

function renderKanbanCards(tasks, dateKey) {
  if (!tasks.length) return `<li class="pill">No tasks</li>`;
  return tasks
    .map((task) => {
      const c = getCategoryColor(task.category);
      const p = getPriorityColor(task.priority);
      return `<li class="kanban-task" draggable="true" data-task-id="${task.id}" data-date-key="${dateKey}" style="background:${shadeColor(c,.35)};border-color:${shadeColor(c,.75)}"><strong>${task.text}</strong><span>${task.category}</span><span class="k-pri" style="color:${p}">${emojiPriority(task.priority)}</span></li>`;
    })
    .join("");
}

function updateTodayTaskByColumn(todayKey, taskId, column) {
  state.tasksByDate[todayKey] = (state.tasksByDate[todayKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    if (column === "done") return { ...task, completed: true, status: "Done" };
    return { ...task, completed: false, status: task.status === "Done" ? "In Progress" : task.status, priority: column };
  });
  saveTasks();
  renderCalendar();
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
    <p><strong>Reminder:</strong> ${task.reminder ? new Date(task.reminder).toLocaleString() : "No reminder"}</p>
    ${task.categoryChecklist?.length ? `<p><strong>Category checklist:</strong> ${task.categoryChecklist.join(", ")}</p>` : ""}
  `;

  renderSubtaskList(task);
  taskDetailsModal.showModal();
}

function renderSubtaskList(task) {
  subtaskList.innerHTML = (task.subtasks || []).length
    ? task.subtasks
        .map((s) => `<li class="subtask-item"><label><input type="checkbox" data-sub-id="${s.id}" ${s.done ? "checked" : ""}/> ${s.title}</label><button type="button" data-sub-del="${s.id}">✕</button></li>`)
        .join("")
    : `<li class="pill">No subtasks</li>`;

  subtaskList.querySelectorAll("[data-sub-id]").forEach((el) => {
    el.addEventListener("change", (e) => toggleSubtask(state.detailRef.dateKey, state.detailRef.taskId, e.target.dataset.subId));
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
  renderCalendar();
}

function toggleSubtask(dateKey, taskId, subtaskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    return { ...task, subtasks: (task.subtasks || []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)) };
  });
  saveTasks();
  openTaskDetails(dateKey, taskId);
  renderCalendar();
}

function deleteSubtask(dateKey, taskId, subtaskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    return { ...task, subtasks: (task.subtasks || []).filter((s) => s.id !== subtaskId) };
  });
  saveTasks();
  openTaskDetails(dateKey, taskId);
  renderCalendar();
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
  const monday = new Date(simple); monday.setDate(simple.getDate() - ((dow + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
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

function renderAnalytics() {
  const all = Object.entries(state.tasksByDate);
  const byCategory = {};
  let completedWeek = 0;
  const now = new Date();
  const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);

  all.forEach(([dateKey, tasks]) => {
    const d = parseDateKey(dateKey);
    tasks.forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      if (t.completed && d >= weekAgo) completedWeek += 1;
    });
  });

  const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = Math.max(1, topCats.reduce((acc, [, n]) => acc + n, 0));
  const pipelineProgress = Math.round(
    (Object.values(state.tasksByDate).flat().filter((t) => t.completed).length / Math.max(1, Object.values(state.tasksByDate).flat().length)) * 100
  );

  analyticsPanel.innerHTML = `
    <small>Tasks Completed This Week: <strong>${completedWeek}</strong></small>
    <small>Pipeline Progress: <strong>${pipelineProgress}%</strong></small>
    <div class="analytics-bar">${topCats.map(([c, n]) => `<small>${c}</small><div><span style="width:${Math.max(8, (n / total) * 100)}%"></span></div>`).join("")}</div>
  `;
}

// Events
document.getElementById("prevMonth").addEventListener("click", () => { state.cursorDate.setMonth(state.cursorDate.getMonth() - 1); renderCalendar(); });
document.getElementById("nextMonth").addEventListener("click", () => { state.cursorDate.setMonth(state.cursorDate.getMonth() + 1); renderCalendar(); });
document.getElementById("todayBtn").addEventListener("click", () => { state.cursorDate = new Date(); renderCalendar(); });

document.getElementById("themeToggle").addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
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
    text: quickTaskText.value.trim(), description: "", status: "Not Started", reminder: "", pomodoroMinutes: 25,
    category: quickTaskCategory.value, priority: quickTaskPriority.value, subtasks: [], categoryChecklist: [],
  });
  quickAddForm.reset();
  quickTaskDate.value = formatDateKey(new Date());
  quickTaskCategory.value = categories[0];
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
newSubtaskInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addSubtaskFromInput(); } });

viewMode.addEventListener("change", setViewModeUI);
filterDate.addEventListener("change", renderFilteredTasks);
filterWeek.addEventListener("change", renderFilteredTasks);

document.getElementById("searchInput").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll(".task-item .task-title").forEach((el) => {
    const hit = !q || el.textContent.toLowerCase().includes(q);
    el.closest(".task-item").style.display = hit ? "grid" : "none";
  });
});

function init() {
  setupSelects();
  carryForwardIncompleteTasks();
  renderWeekdays();
  quickTaskDate.value = formatDateKey(new Date());
  filterDate.value = formatDateKey(new Date());
  quickTaskCategory.value = categories[0];
  quickTaskPriority.value = "medium";
  renderCategoryOptions(taskCategory.value || categories[0]);
  setViewModeUI();
  renderCalendar();
  setInterval(checkReminders, 30000);
}

init();
