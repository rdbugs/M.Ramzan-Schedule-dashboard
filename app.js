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
  "social media publishing": [
    "📝 CONTENT WRITING",
    "▶️ Youtube",
    "📸 Insta",
    "📘 FB",
    "🎵 Tiktok",
    "💼 Linkedin",
  ],
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
  reminders: new Set(),
  pomodoroTimer: null,
  pomodoroSecondsLeft: 25 * 60,
};

const monthLabel = document.getElementById("monthLabel");
const todayDateLabel = document.getElementById("todayDateLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekdayRow = document.getElementById("weekdayRow");

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
  return categoryColors[category] || "#e2e8f0";
}

function getPriorityColor(priority) {
  if (priority === "high") return "#ef4444";
  if (priority === "medium") return "#f97316";
  return "#16a34a";
}

function shadeColor(hex, opacity = 0.18) {
  const value = hex.replace("#", "");
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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

function sortedTasks(tasks) {
  return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));
}

function emojiPriority(priority) {
  if (priority === "high") return "🔴 High";
  if (priority === "medium") return "🟠 Medium";
  return "🟢 Low";
}

function carryForwardIncompleteTasks() {
  const todayKey = formatDateKey(new Date());
  const alreadyCarried = localStorage.getItem(CARRYOVER_KEY);
  if (alreadyCarried === todayKey) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  const prevTasks = state.tasksByDate[yesterdayKey] || [];
  if (!prevTasks.length) {
    localStorage.setItem(CARRYOVER_KEY, todayKey);
    return;
  }

  const todayTasks = state.tasksByDate[todayKey] || [];
  const incomplete = prevTasks.filter((task) => !task.completed);

  incomplete.forEach((task) => {
    const exists = todayTasks.some(
      (t) => t.carriedFromDate === yesterdayKey && t.carriedFromTaskId === task.id
    );
    if (!exists) {
      todayTasks.push({
        ...task,
        id: safeUUID(),
        carriedFromDate: yesterdayKey,
        carriedFromTaskId: task.id,
      });
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
      <div class="day-head">
        <strong>${date.getDate()}</strong>
        <button type="button" data-add="${dateKey}">+ Task</button>
      </div>
      <small>${date.toLocaleString("en-US", { weekday: "short" })}</small>
      <ul class="task-list" data-day-list="${dateKey}"></ul>
    `;

    const listEl = cell.querySelector(".task-list");
    listEl.addEventListener("dragover", (event) => {
      event.preventDefault();
      listEl.style.background = "#eff6ff";
    });
    listEl.addEventListener("dragleave", () => (listEl.style.background = ""));
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
  checkReminders();
}

function createTaskElement(task, dateKey) {
  const li = document.createElement("li");
  li.className = "task-item";
  li.draggable = true;

  const categoryColor = getCategoryColor(task.category);
  const priorityColor = getPriorityColor(task.priority);
  li.style.background = `linear-gradient(110deg, ${shadeColor(categoryColor, 0.26)} 0%, #ffffff 75%)`;
  li.style.borderLeftColor = priorityColor;

  li.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", JSON.stringify({ fromDateKey: dateKey, taskId: task.id }));
  });

  const subtaskSummary = task.subtasks?.length ? `<span class="pill">${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length} subtasks</span>` : "";
  const carryInfo = task.carriedFromDate ? `<span class="pill">↪ from ${task.carriedFromDate}</span>` : "";

  li.innerHTML = `
    <div class="task-main">
      <input type="checkbox" data-toggle="${task.id}" ${task.completed ? "checked" : ""} />
      <span class="task-title ${task.completed ? "done" : ""}">${task.text}</span>
    </div>
    <div class="task-meta">
      <span class="pill category-pill" style="background:${shadeColor(categoryColor, 0.45)};border-color:${shadeColor(categoryColor,0.75)}">${task.category}</span>
      <span class="pill priority-pill ${task.priority}">${emojiPriority(task.priority)}</span>
      <span class="pill">${task.status || "Not Started"}</span>
      ${subtaskSummary}
      ${carryInfo}
    </div>
    <div class="task-actions">
      <button type="button" data-view="${task.id}">View</button>
      <button type="button" data-edit="${task.id}">Edit</button>
      <button type="button" data-delete="${task.id}">Delete</button>
    </div>
  `;

  li.querySelector(`[data-toggle="${task.id}"]`).addEventListener("change", () => toggleTask(dateKey, task.id));
  li.querySelector(`[data-view="${task.id}"]`).addEventListener("click", () => openTaskDetails(dateKey, task.id));
  li.querySelector(`[data-edit="${task.id}"]`).addEventListener("click", () => openTaskModal(dateKey, task));
  li.querySelector(`[data-delete="${task.id}"]`).addEventListener("click", () => deleteTask(dateKey, task.id));

  return li;
}

function renderCategoryOptions(selectedCategory, existingChecks = []) {
  const templateItems = categoryChecklistTemplates[selectedCategory] || [];
  if (!templateItems.length) {
    categoryOptions.innerHTML = "";
    categoryOptions.classList.add("hidden");
    return;
  }

  categoryOptions.classList.remove("hidden");
  categoryOptions.innerHTML = `
    <h4>${selectedCategory} checklist</h4>
    <div class="checkbox-grid">
      ${templateItems
        .map(
          (item) =>
            `<label><input type="checkbox" value="${item}" data-cat-check ${existingChecks.includes(item) ? "checked" : ""} /> ${item}</label>`
        )
        .join("")}
    </div>
  `;
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
  taskSubtasks.value = task?.subtasks?.map((sub) => sub.title).join("\n") || "";
  taskModal.showModal();
}

function collectTaskPayload() {
  const subtaskTitles = taskSubtasks.value.split("\n").map((item) => item.trim()).filter(Boolean);
  const existing = (state.tasksByDate[state.modalDateKey] || []).find((task) => task.id === state.editingTaskId);

  const subtasks = subtaskTitles.map((title) => {
    const old = existing?.subtasks?.find((sub) => sub.title === title);
    return old ? old : { id: safeUUID(), title, done: false };
  });

  const categoryChecklist = [...categoryOptions.querySelectorAll("[data-cat-check]:checked")].map((checkbox) => checkbox.value);

  return {
    text: taskText.value.trim(),
    description: taskDescription.value.trim(),
    status: taskStatus.value,
    reminder: taskReminder.value,
    pomodoroMinutes: Number(taskPomodoro.value) || 25,
    category: taskCategory.value,
    priority: taskPriority.value,
    subtasks,
    categoryChecklist,
  };
}

function addOrUpdateTask(dateKey, payload, taskId = null) {
  const tasks = state.tasksByDate[dateKey] || [];
  if (taskId) {
    state.tasksByDate[dateKey] = tasks.map((task) => (task.id === taskId ? { ...task, ...payload } : task));
  } else {
    state.tasksByDate[dateKey] = [...tasks, { id: safeUUID(), completed: false, ...payload }];
  }

  saveTasks();
  renderCalendar();
}

function deleteTask(dateKey, taskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).filter((task) => task.id !== taskId);
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
  const allTasks = Object.values(state.tasksByDate).flat();
  const todayKey = formatDateKey(new Date());
  document.getElementById("dueTodayCount").textContent = (state.tasksByDate[todayKey] || []).length;
  document.getElementById("highPriorityCount").textContent = allTasks.filter((task) => task.priority === "high" && !task.completed).length;
  document.getElementById("completedCount").textContent = allTasks.filter((task) => task.completed).length;
}

function renderTodayFocusPanel() {
  const todayKey = formatDateKey(new Date());
  const todaysTasks = sortedTasks(state.tasksByDate[todayKey] || []);

  todayDateLabel.textContent = parseDateKey(todayKey).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const groups = {
    high: todaysTasks.filter((task) => task.priority === "high" && !task.completed),
    medium: todaysTasks.filter((task) => task.priority === "medium" && !task.completed),
    low: todaysTasks.filter((task) => task.priority === "low" && !task.completed),
    done: todaysTasks.filter((task) => task.completed),
  };

  document.getElementById("todayFocusBoard").innerHTML = [
    columnTemplate("High Impact", groups.high),
    columnTemplate("Medium", groups.medium),
    columnTemplate("Low", groups.low),
    columnTemplate("Done", groups.done),
  ].join("");
}

function columnTemplate(title, tasks) {
  const list = tasks.length
    ? tasks
        .map((task) => {
          const c = getCategoryColor(task.category);
          const p = getPriorityColor(task.priority);
          return `<li class="kanban-task" style="background:${shadeColor(c, 0.38)}; border-color:${shadeColor(c, 0.75)}"><strong>${task.text}</strong><span>${task.category}</span><span class="k-pri" style="color:${p}">${emojiPriority(task.priority)}</span></li>`;
        })
        .join("")
    : `<li class="pill">No tasks</li>`;
  return `<section class="kanban-column"><h3>${title}</h3><ul>${list}</ul></section>`;
}

function openDayTasksModal(dateKey) {
  const tasks = sortedTasks(state.tasksByDate[dateKey] || []);
  dayTasksTitle.textContent = `Tasks for ${parseDateKey(dateKey).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  dayTasksList.innerHTML = tasks.length
    ? tasks.map((task) => `<li><strong>${task.text}</strong><br /><small>${task.status || "Not Started"} • ${emojiPriority(task.priority)} • ${task.category}</small></li>`).join("")
    : "<li>No tasks for this day.</li>";
  dayTasksModal.showModal();
}

function openTaskDetails(dateKey, taskId) {
  const task = (state.tasksByDate[dateKey] || []).find((item) => item.id === taskId);
  if (!task) return;

  state.pomodoroSecondsLeft = (task.pomodoroMinutes || 25) * 60;
  renderPomodoroDisplay();

  const checklistHtml = task.categoryChecklist?.length
    ? `<p><strong>Category checklist:</strong> ${task.categoryChecklist.join(", ")}</p>`
    : "";

  taskDetailsTitle.textContent = task.text;
  taskDetailsBody.innerHTML = `
    <p><strong>Description:</strong> ${task.description || "No description"}</p>
    <p><strong>Status:</strong> ${task.status || "Not Started"}</p>
    <p><strong>Category:</strong> ${task.category}</p>
    <p><strong>Priority:</strong> ${emojiPriority(task.priority)}</p>
    <p><strong>Reminder:</strong> ${task.reminder ? new Date(task.reminder).toLocaleString() : "No reminder"}</p>
    ${checklistHtml}
    <div><strong>Subtasks:</strong><ul>${task.subtasks?.length ? task.subtasks.map((subtask) => `<li><label><input type="checkbox" data-subtask-id="${subtask.id}" ${subtask.done ? "checked" : ""} /> ${subtask.title}</label></li>`).join("") : "<li>No subtasks</li>"}</ul></div>
  `;

  taskDetailsBody.querySelectorAll("[data-subtask-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => toggleSubtask(dateKey, taskId, event.target.dataset.subtaskId));
  });

  taskDetailsModal.showModal();
}

function toggleSubtask(dateKey, taskId, subtaskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) => {
    if (task.id !== taskId) return task;
    const subtasks = (task.subtasks || []).map((sub) => (sub.id === subtaskId ? { ...sub, done: !sub.done } : sub));
    return { ...task, subtasks };
  });
  saveTasks();
  renderCalendar();
  openTaskDetails(dateKey, taskId);
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

// Events
document.getElementById("prevMonth").addEventListener("click", () => {
  state.cursorDate.setMonth(state.cursorDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  state.cursorDate.setMonth(state.cursorDate.getMonth() + 1);
  renderCalendar();
});

document.getElementById("todayBtn").addEventListener("click", () => {
  state.cursorDate = new Date();
  renderCalendar();
});

taskCategory.addEventListener("change", () => {
  renderCategoryOptions(taskCategory.value);
});

calendarGrid.addEventListener("click", (event) => {
  const addBtn = event.target.closest("button[data-add]");
  if (addBtn) {
    openTaskModal(addBtn.dataset.add);
    return;
  }

  const cell = event.target.closest(".day-cell");
  if (cell && !event.target.closest(".task-item")) {
    openDayTasksModal(cell.dataset.dateKey);
  }
});

quickAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addOrUpdateTask(quickTaskDate.value, {
    text: quickTaskText.value.trim(),
    description: "",
    status: "Not Started",
    reminder: "",
    pomodoroMinutes: 25,
    category: quickTaskCategory.value,
    priority: quickTaskPriority.value,
    subtasks: [],
    categoryChecklist: [],
  });

  quickAddForm.reset();
  quickTaskDate.value = formatDateKey(new Date());
  quickTaskCategory.value = categories[0];
  quickTaskPriority.value = "medium";
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = collectTaskPayload();

  if (state.editingTaskId) {
    addOrUpdateTask(state.modalDateKey, payload, state.editingTaskId);
  } else {
    addOrUpdateTask(state.modalDateKey, payload, null);
  }

  state.editingTaskId = null;
  taskModal.close();
});

document.getElementById("cancelTaskBtn").addEventListener("click", () => {
  state.editingTaskId = null;
  taskModal.close();
});

document.getElementById("closeDayTasks").addEventListener("click", () => dayTasksModal.close());
document.getElementById("closeTaskDetails").addEventListener("click", () => taskDetailsModal.close());
document.getElementById("startPomodoro").addEventListener("click", startPomodoro);

viewMode.addEventListener("change", setViewModeUI);
filterDate.addEventListener("change", renderFilteredTasks);
filterWeek.addEventListener("change", renderFilteredTasks);

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
