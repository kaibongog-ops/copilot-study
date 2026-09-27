const STORAGE_KEY = 'simple-todo-items';
const THEME_KEY = 'simple-todo-theme';

const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const countDisplay = document.querySelector('#todo-count');
const filterButtons = document.querySelectorAll('[data-filter]');
const todoStatus = document.querySelector('#todo-status');
const clearCompletedButton = document.querySelector('#clear-completed-btn');
const themeToggle = document.querySelector('#theme-toggle');
const themeIcon = document.querySelector('.theme-icon');

let todos = loadTodos();
let editingId = null;
let editingDraft = null;
let currentFilter = 'all';

function generateTodoId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`localStorage.getItem failed for "${key}"`, error);
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`localStorage.setItem failed for "${key}"`, error);
    return false;
  }
}

function loadTodos() {
  try {
    const saved = readStorage(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.warn('Failed to parse saved todos from localStorage.', error);
    return [];
  }
}

function saveTodos() {
  writeStorage(STORAGE_KEY, JSON.stringify(todos));
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-theme', isDark);

  if (themeIcon) {
    themeIcon.textContent = isDark ? '☀️' : '🌙';
  }

  if (themeToggle) {
    themeToggle.setAttribute('aria-label', isDark ? 'ライトモードに切り替える' : 'ダークモードに切り替える');
  }

  writeStorage(THEME_KEY, theme);
}

function initTheme() {
  const savedTheme = readStorage(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme);
}

function updateClearCompletedButton() {
  if (!clearCompletedButton) {
    return;
  }

  const hasCompletedTodos = todos.some((todo) => todo.completed);
  clearCompletedButton.hidden = !hasCompletedTodos;
}

function updateTodoCount() {
  if (!countDisplay) {
    return;
  }

  const pendingTodos = todos.filter((todo) => !todo.completed).length;
  countDisplay.textContent = String(pendingTodos);
}

function updateFilterButtons() {
  filterButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === currentFilter));
  });
}

function renderTodos() {
  list.innerHTML = '';
  updateClearCompletedButton();
  updateTodoCount();

  const visibleTodos = todos.filter((todo) => {
    if (currentFilter === 'active') {
      return !todo.completed;
    }

    if (currentFilter === 'completed') {
      return todo.completed;
    }

    return true;
  });

  if (todos.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'empty-state';
    emptyItem.textContent = 'まだタスクがありません';
    list.appendChild(emptyItem);
    return;
  }

  if (visibleTodos.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'empty-state';
    emptyItem.textContent = '条件に一致するタスクがありません';
    list.appendChild(emptyItem);
    return;
  }

  visibleTodos.forEach((todo) => {
    const item = document.createElement('li');
    const isEditing = editingId === todo.id;
    item.className = `todo-item${todo.completed ? ' completed' : ''}${isEditing ? ' editing' : ''}`;

    if (isEditing) {
      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'todo-edit-input';
      editInput.value = editingDraft;
      editInput.setAttribute('aria-label', `タスク編集: ${todo.text}`);
      editInput.addEventListener('input', () => {
        editingDraft = editInput.value;
      });

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'save-btn';
      saveButton.textContent = '保存';
      saveButton.addEventListener('click', () => {
        const updatedText = editInput.value.trim();
        if (!updatedText) {
          editInput.focus();
          return;
        }

        todo.text = updatedText;
        editingId = null;
        editingDraft = null;
        saveTodos();
        renderTodos();
      });

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'cancel-btn';
      cancelButton.textContent = 'キャンセル';
      cancelButton.addEventListener('click', () => {
        editingId = null;
        editingDraft = null;
        renderTodos();
      });

      editInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          saveButton.click();
        }

        if (event.key === 'Escape') {
          cancelButton.click();
        }
      });

      item.appendChild(editInput);
      item.appendChild(saveButton);
      item.appendChild(cancelButton);
      list.appendChild(item);

      requestAnimationFrame(() => editInput.focus());
      return;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `完了: ${todo.text}`);
    checkbox.addEventListener('change', () => {
      todo.completed = checkbox.checked;
      saveTodos();
      renderTodos();
    });

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'edit-btn';
    editButton.textContent = '編集';
    editButton.setAttribute('aria-label', `編集: ${todo.text}`);
    editButton.addEventListener('click', () => {
      editingId = todo.id;
      editingDraft = todo.text;
      renderTodos();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = '×';
    deleteButton.setAttribute('aria-label', `削除: ${todo.text}`);
    deleteButton.addEventListener('click', () => {
      todos = todos.filter((task) => task.id !== todo.id);
      if (editingId === todo.id) {
        editingId = null;
        editingDraft = null;
      }
      saveTodos();
      renderTodos();
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    item.appendChild(checkbox);
    item.appendChild(text);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  todos.unshift({
    id: generateTodoId(),
    text,
    completed: false,
  });

  input.value = '';
  input.focus();
  if (todoStatus) {
    todoStatus.textContent = currentFilter === 'completed'
      ? 'タスクを追加しました。現在の「完了」表示には含まれません。'
      : '';
  }
  saveTodos();
  renderTodos();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    if (todoStatus) {
      todoStatus.textContent = '';
    }
    updateFilterButtons();
    renderTodos();
  });
});

themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
  applyTheme(nextTheme);
});

if (clearCompletedButton) {
  clearCompletedButton.addEventListener('click', () => {
    todos = todos.filter((todo) => !todo.completed);
    if (editingId !== null && todos.every((todo) => todo.id !== editingId)) {
      editingId = null;
      editingDraft = null;
    }
    saveTodos();
    renderTodos();
  });
}

initTheme();
updateFilterButtons();
renderTodos();

// 完了済みタスクをすべて削除する関数
function deleteCompletedTodos() {
  const remainingTodos = todos.filter((todo) => !todo.completed);
  todos = remainingTodos;
  saveTodos();
  renderTodos();
}

// 未完了のタスク数を数える関数
function countPendingTodos() {
  const pendingTodos = todos.filter((todo) => !todo.completed);
  return pendingTodos.length;
}

function getTodoCount() {
  return todos.length;
}