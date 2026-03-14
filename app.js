const STORAGE_KEY = "content-planner-tasks-v1";

const categories = [
  "Video Shoot",
  "Video Editing",
  "Social Media Post",
  "Post Design",
  "Print Design",
  "Other Tasks",
];

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
};

const monthLabel = document.getElementById("monthLabel");
const todayDateLabel = document.getElementById("todayDateLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekdayRow = document.getElementById("weekdayRow");
const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskModalTitle = document.getElementById("taskModalTitle");

const taskText = document.getElementById("taskText");
const taskCategory = document.getElementById("taskCategory");
const taskPriority = document.getElementById("taskPriority");

const quickAddForm = document.getElementById("quickAddForm");
const quickTaskText = document.getElementById("quickTaskText");
const quickTaskDate = document.getElementById("quickTaskDate");
const quickTaskCategory = document.getElementById("quickTaskCategory");
const quickTaskPriority = document.getElementById("quickTaskPriority");

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

function setupSelects() {
  const categoryOptions = categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  const priorityOptions = priorities
    .map((p) => `<option value="${p.value}">${p.label}</option>`)
    .join("");

  [taskCategory, quickTaskCategory].forEach((select) => {
    select.innerHTML = categoryOptions;
  });

  [taskPriority, quickTaskPriority].forEach((select) => {
    select.innerHTML = priorityOptions;
  });
}

function renderWeekdays() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdayRow.innerHTML = days.map((day) => `<div>${day}</div>`).join("");
}

function sortedTasks(tasks) {
  return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));
}

function renderCalendar() {
  const year = state.cursorDate.getFullYear();
  const month = state.cursorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  monthLabel.textContent = firstDay.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  calendarGrid.innerHTML = "";

  for (let i = 0; i < totalCells; i += 1) {
    const date = new Date(year, month, i - startOffset + 1);
    const dateKey = formatDateKey(date);
    const dayTasks = sortedTasks(state.tasksByDate[dateKey] || []);
    const isCurrentMonth = date.getMonth() === month;

    const cell = document.createElement("article");
    cell.className = `day-cell${isCurrentMonth ? "" : " outside"}${
      dateKey === formatDateKey(new Date()) ? " today" : ""
    }`;

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

    listEl.addEventListener("dragleave", () => {
      listEl.style.background = "";
    });

    listEl.addEventListener("drop", (event) => {
      event.preventDefault();
      listEl.style.background = "";
      const raw = event.dataTransfer.getData("text/plain");
      if (!raw) return;
      const { fromDateKey, taskId } = JSON.parse(raw);
      moveTask(fromDateKey, dateKey, taskId);
    });

    dayTasks.forEach((task) => {
      listEl.appendChild(createTaskElement(task, dateKey));
    });

    calendarGrid.appendChild(cell);
  }

  renderTodayFocusPanel();
  renderSummary();
}

function createTaskElement(task, dateKey) {
  const li = document.createElement("li");
  li.className = `task-item priority-${task.priority}`;
  li.draggable = true;
  li.dataset.taskId = task.id;

  li.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ fromDateKey: dateKey, taskId: task.id })
    );
  });

  li.innerHTML = `
    <div class="task-main">
      <input type="checkbox" data-toggle="${task.id}" ${task.completed ? "checked" : ""} />
      <span class="task-title ${task.completed ? "done" : ""}">${task.text}</span>
    </div>
    <div class="task-meta">
      <span class="pill">${task.category}</span>
      <span class="pill priority-pill ${task.priority}">${emojiPriority(task.priority)}</span>
    </div>
    <div class="task-actions">
      <button type="button" data-edit="${task.id}">Edit</button>
      <button type="button" data-delete="${task.id}">Delete</button>
    </div>
  `;

  li.querySelector(`[data-toggle="${task.id}"]`).addEventListener("change", () => {
    toggleTask(dateKey, task.id);
  });

  li.querySelector(`[data-edit="${task.id}"]`).addEventListener("click", () => {
    openTaskModal(dateKey, task);
  });

  li.querySelector(`[data-delete="${task.id}"]`).addEventListener("click", () => {
    deleteTask(dateKey, task.id);
  });

  return li;
}

function emojiPriority(priority) {
  if (priority === "high") return "🔴 High";
  if (priority === "medium") return "🟠 Medium";
  return "🟢 Low";
}

function openTaskModal(dateKey, task = null) {
  state.modalDateKey = dateKey;
  state.editingTaskId = task?.id || null;
  taskModalTitle.textContent = task ? "Edit Task" : "Add Task";
  taskText.value = task?.text || "";
  taskCategory.value = task?.category || categories[0];
  taskPriority.value = task?.priority || "medium";
  taskModal.showModal();
}

function addOrUpdateTask(dateKey, payload) {
  const tasks = state.tasksByDate[dateKey] || [];
  if (payload.id) {
    state.tasksByDate[dateKey] = tasks.map((task) => (task.id === payload.id ? payload : task));
  } else {
    state.tasksByDate[dateKey] = [
      ...tasks,
      {
        id: crypto.randomUUID(),
        ...payload,
        completed: false,
      },
    ];
  }
  saveTasks();
  renderCalendar();
}

function deleteTask(dateKey, taskId) {
  const tasks = state.tasksByDate[dateKey] || [];
  state.tasksByDate[dateKey] = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderCalendar();
}

function toggleTask(dateKey, taskId) {
  state.tasksByDate[dateKey] = (state.tasksByDate[dateKey] || []).map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );
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
  const dueToday = (state.tasksByDate[todayKey] || []).length;
  const highPriority = allTasks.filter((task) => task.priority === "high" && !task.completed).length;
  const completed = allTasks.filter((task) => task.completed).length;

  document.getElementById("dueTodayCount").textContent = dueToday;
  document.getElementById("highPriorityCount").textContent = highPriority;
  document.getElementById("completedCount").textContent = completed;
}

function renderTodayFocusPanel() {
  const todayKey = formatDateKey(new Date());
  const todaysTasks = sortedTasks(state.tasksByDate[todayKey] || []);
  todayDateLabel.textContent = parseDateKey(todayKey).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const groups = {
    high: todaysTasks.filter((task) => task.priority === "high" && !task.completed),
    medium: todaysTasks.filter((task) => task.priority === "medium" && !task.completed),
    low: todaysTasks.filter((task) => task.priority === "low" && !task.completed),
    done: todaysTasks.filter((task) => task.completed),
  };

  const board = document.getElementById("todayFocusBoard");
  board.innerHTML = [
    columnTemplate("High Impact", groups.high),
    columnTemplate("Medium", groups.medium),
    columnTemplate("Low", groups.low),
    columnTemplate("Done", groups.done),
  ].join("");
}

function columnTemplate(title, tasks) {
  const list = tasks.length
    ? tasks.map((task) => `<li class="pill">${task.text}</li>`).join("")
    : `<li class="pill">No tasks</li>`;
  return `<section class="kanban-column"><h3>${title}</h3><ul>${list}</ul></section>`;
}

// Event listeners

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

calendarGrid.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-add]");
  if (!btn) return;
  openTaskModal(btn.dataset.add);
});

quickAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addOrUpdateTask(quickTaskDate.value, {
    text: quickTaskText.value.trim(),
    category: quickTaskCategory.value,
    priority: quickTaskPriority.value,
  });
  quickAddForm.reset();
  quickTaskDate.value = formatDateKey(new Date());
  quickTaskCategory.value = categories[0];
  quickTaskPriority.value = "medium";
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addOrUpdateTask(state.modalDateKey, {
    id: state.editingTaskId,
    text: taskText.value.trim(),
    category: taskCategory.value,
    priority: taskPriority.value,
    completed:
      (state.tasksByDate[state.modalDateKey] || []).find((task) => task.id === state.editingTaskId)
        ?.completed || false,
  });
  taskModal.close();
});

document.getElementById("cancelTaskBtn").addEventListener("click", () => {
  taskModal.close();
});

function init() {
  setupSelects();
  renderWeekdays();
  quickTaskDate.value = formatDateKey(new Date());
  quickTaskCategory.value = categories[0];
  quickTaskPriority.value = "medium";
  renderCalendar();
}

init();
