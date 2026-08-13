const STORAGE_KEY = 'simple-todo-items';
const THEME_KEY = 'simple-todo-theme';

const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const themeToggle = document.querySelector('#theme-toggle');
const themeIcon = document.querySelector('.theme-icon');

let todos = loadTodos();
let editingId = null;

function loadTodos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
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

  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme);
}

function renderTodos() {
  list.innerHTML = '';

  if (todos.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'empty-state';
    emptyItem.textContent = 'まだタスクがありません';
    list.appendChild(emptyItem);
    return;
  }

  todos.forEach((todo) => {
    const item = document.createElement('li');
    const isEditing = editingId === todo.id;
    item.className = `todo-item${todo.completed ? ' completed' : ''}${isEditing ? ' editing' : ''}`;

    if (isEditing) {
      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'todo-edit-input';
      editInput.value = todo.text;
      editInput.setAttribute('aria-label', `タスク編集: ${todo.text}`);

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
        saveTodos();
        renderTodos();
      });

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'cancel-btn';
      cancelButton.textContent = 'キャンセル';
      cancelButton.addEventListener('click', () => {
        editingId = null;
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
    id: Date.now(),
    text,
    completed: false,
  });

  input.value = '';
  input.focus();
  saveTodos();
  renderTodos();
});

themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
  applyTheme(nextTheme);
});

initTheme();
renderTodos();
