import { GitHubClient } from './github.js';
import {
  parseDocument,
  serializeDocument,
  defaultListContent,
  makeId,
  GENERAL_TITLE,
} from './markdown.js';

/* ---------------------------------------------------------------- icons */
const ICONS = {
  checkSquare: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
  pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  repo: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.9 17.9A11 11 0 0 1 12 19c-7 0-11-7-11-7a18 18 0 0 1 3.6-4.4M9.9 4.2A11 11 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
};

function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* --------------------------------------------------------------- helpers */
const APP_VERSION = '6';
const LS_REPO = 'gittasks-repo';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastRoot = document.getElementById('toast-root');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch { return ''; }
}

function prettyName(path) {
  const base = path.split('/').pop().replace(/\.md$/i, '');
  return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Untitled';
}

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function dueInfo(due) {
  if (!due) return null;
  const d = new Date(`${due}T00:00:00`);
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return { cls: 'overdue', label: `Overdue ${Math.abs(diff)}d` };
  if (diff === 0) return { cls: 'today', label: 'Today' };
  if (diff <= 3) return { cls: 'soon', label: `In ${diff}d` };
  return { cls: '', label: '' };
}

function reportError(err) {
  const message = (err && err.message) || String(err);
  state.error = message;
  if (state.view === 'board') render();
  toast(message, 'error');
}

function toast(message, type = 'info') {
  const el = document.createElement('div');
  const ic = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon(ic, 17)}</span><span class="toast-msg">${esc(message)}</span><button class="icon-btn sm" data-action="dismiss-toast">${icon('x', 14)}</button>`;
  toastRoot.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }, 4200);
}

/* ----------------------------------------------------------------- state */
const state = {
  token: '', remember: false, client: null,
  user: null, repos: [], repoFilter: '',
  repo: null, lists: [], activePath: null,
  view: 'login', completedCollapsed: false, error: '', saving: new Set(),
};

function ctx() {
  const r = state.repo;
  return { owner: r.owner.login, repo: r.name, branch: r.default_branch };
}
function activeList() {
  return state.lists.find((l) => l.path === state.activePath) || null;
}

function saveToken() {
  if (state.remember) {
    localStorage.setItem('gittasks-token', state.token);
    sessionStorage.removeItem('gittasks-token');
  } else {
    sessionStorage.setItem('gittasks-token', state.token);
    localStorage.removeItem('gittasks-token');
  }
}
function clearToken() {
  localStorage.removeItem('gittasks-token');
  sessionStorage.removeItem('gittasks-token');
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('gittasks-theme', next);
  render();
}

/* ------------------------------------------------------------ API / data */
async function connect() {
  state.client = new GitHubClient(state.token);
  state.user = await state.client.verify();
  state.repos = await state.client.listRepos();

  // Reopen the last-used repository automatically. If it is no longer
  // accessible with this token, drop the saved choice and show the picker.
  const saved = localStorage.getItem(LS_REPO);
  if (saved && state.repos.some((r) => r.full_name === saved)) {
    await doOpenRepo(saved);
    return;
  }
  if (saved) localStorage.removeItem(LS_REPO);
  state.view = 'repos';
  render();
}

async function loadLists(repo) {
  const { owner, repo: name, branch } = (() => {
    const r = repo;
    return { owner: r.owner.login, repo: r.name, branch: r.default_branch };
  })();
  const files = await state.client.listMarkdownFiles(owner, name, branch);
  const lists = [];
  for (const f of files.slice(0, 100)) {
    try {
      const { content, sha } = await state.client.getFile(owner, name, f.path, branch);
      const fileName = f.path.split('/').pop();
      lists.push({ path: f.path, sha, name: fileName, doc: parseDocument(content, fileName) });
    } catch { /* skip files we can't read */ }
  }
  state.lists = lists;
}

async function createList(name, silent = false) {
  const clean = String(name || '').trim().replace(/[<>:"/\\|?*#\[\]]/g, '')
    .replace(/\s+/g, ' ').trim() || 'List';
  let path = `${clean}.md`;
  let i = 2;
  while (state.lists.some((l) => l.path.toLowerCase() === path.toLowerCase())) {
    path = `${clean}-${i++}.md`;
  }
  const doc = parseDocument(defaultListContent(clean), clean);
  const { owner, repo, branch } = ctx();
  const { sha } = await state.client.putFile(
    owner, repo, path, serializeDocument(doc), null, `Create list: ${path}`, branch
  );
  const list = { path, sha: sha || null, name: path.split('/').pop(), doc };
  state.lists.push(list);
  if (!silent) {
    state.activePath = path;
    state.view = 'board';
    render();
    toast(`List “${path.split('/').pop()}” created`, 'success');
  }
  return list;
}

async function commitList(list, message) {
  const { owner, repo, branch } = ctx();
  // Re-read the file immediately before every write. SHA values from the
  // initial load go stale the moment anything changes on GitHub, and a 404
  // here simply means the file does not exist yet (create, no SHA required).
  let sha = null;
  try {
    const fresh = await state.client.getFile(owner, repo, list.path, branch);
    sha = fresh.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const { sha: newSha } = await state.client.putFile(
    owner, repo, list.path, serializeDocument(list.doc), sha, message, branch
  );
  list.sha = newSha || sha || null;
}

async function doOpenRepo(fullName) {
  const repo = state.repos.find((r) => r.full_name === fullName);
  if (!repo) return;
  state.repo = repo;
  state.lists = [];
  state.activePath = null;
  app.innerHTML = `<div class="app-shell"><header class="topbar"><div class="topbar-left brand">${icon('checkSquare', 24)} GitTasks</div></header><div class="loading-row">${icon('spinner', 18)} Loading lists from <strong>&nbsp;${esc(fullName)}</strong>…</div></div>`;
  try {
    await loadLists(repo);
    // Use the repository's own .md files as lists. Never invent a General.md —
    // users create lists explicitly with the + button.
    state.activePath = state.lists.length ? state.lists[0].path : null;
    state.view = 'board';
    state.completedCollapsed = false;
    localStorage.setItem(LS_REPO, fullName);
    render();
  } catch (e) {
    toast(e.message, 'error');
    state.view = 'repos';
    render();
  }
}

async function onSync() {
  try {
    await loadLists(state.repo);
    if (!state.lists.some((l) => l.path === state.activePath)) {
      state.activePath = state.lists[0]?.path || null;
    }
    render();
    toast('Synced with GitHub', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

function doLogout() {
  clearToken();
  localStorage.removeItem(LS_REPO);
  Object.assign(state, {
    token: '', client: null, user: null, repos: [], repoFilter: '',
    repo: null, lists: [], activePath: null, view: 'login',
  });
  closeModal();
  render();
}

/* ------------------------------------------------------------ task ops */
async function onToggleTask(id) {
  const list = activeList();
  const t = list?.doc.tasks.find((x) => x.id === id);
  if (!t || state.saving.has(id)) return;
  t.completed = !t.completed;
  state.saving.add(id);
  render();
  try {
    await commitList(list, t.completed ? 'Complete task' : 'Reopen task');
  } catch (e) {
    t.completed = !t.completed;
    state.error = (e && e.message) || String(e);
    toast(state.error, 'error');
  } finally {
    state.saving.delete(id);
    render();
  }
}

async function onSaveTask(form) {
  toast('Saving to GitHub…', 'info');
  const fd = new FormData(form);
  const id = String(fd.get('id') || '');
  const title = String(fd.get('title') || '').trim();
  if (!title) { toast('Task title is required.', 'error'); return; }
  const due = String(fd.get('due') || '').trim();
  const link = safeUrl(String(fd.get('link') || '').trim());
  const desc = String(fd.get('desc') || '').trim();
  const targetPath = String(fd.get('path') || '');
  const source = activeList();
  if (!source) return;
  const editing = id ? source.doc.tasks.find((t) => t.id === id) : null;

  try {
    if (editing && targetPath !== source.path) {
      const target = state.lists.find((l) => l.path === targetPath);
      source.doc.tasks = source.doc.tasks.filter((t) => t.id !== id);
      target.doc.tasks.push({ ...editing, title, due, link, desc, id: makeId(), completed: false });
      await commitList(source, `Move task: ${title}`);
      await commitList(target, `Move task: ${title}`);
      state.activePath = targetPath;
    } else if (editing) {
      Object.assign(editing, { title, due, link, desc });
      await commitList(source, `Update task: ${title}`);
    } else {
      const target = state.lists.find((l) => l.path === targetPath) || source;
      target.doc.tasks.push({ id: makeId(), title, due, link, desc, completed: false, meta: {} });
      await commitList(target, `Add task: ${title}`);
      state.activePath = target.path;
    }
    closeModal();
    state.error = '';
    render();
    toast('Saved to GitHub', 'success');
  } catch (e) {
    closeModal();
    reportError(e);
  }
}

async function onMoveTo(id, targetPath) {
  const source = activeList();
  const target = state.lists.find((l) => l.path === targetPath);
  const t = source?.doc.tasks.find((x) => x.id === id);
  if (!t || !target || source.path === target.path) { closeModal(); return; }
  source.doc.tasks = source.doc.tasks.filter((x) => x.id !== id);
  target.doc.tasks.push(t);
  try {
    await commitList(source, `Move task: ${t.title}`);
    await commitList(target, `Move task: ${t.title}`);
    state.activePath = target.path;
    closeModal();
    render();
    toast(`Moved to “${target.name}”`, 'success');
  } catch (e) {
    await loadLists(state.repo).catch(() => {});
    closeModal();
    render();
    toast(e.message, 'error');
  }
}

let confirmResolver = null;
function showConfirm({ title, text, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    openModalRaw(`
      <div class="modal" role="alertdialog" aria-modal="true">
        <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-modal">${icon('x')}</button></div>
        <div class="modal-body">
          <p class="confirm-text">${esc(text)}</p>
          <div class="modal-foot" style="margin-top:22px">
            <button class="btn btn-secondary" data-action="confirm-no">Cancel</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-yes">${esc(confirmText)}</button>
          </div>
        </div>
      </div>`);
  });
}

async function onDeleteTask(id) {
  const list = activeList();
  const t = list?.doc.tasks.find((x) => x.id === id);
  if (!t) return;
  const ok = await showConfirm({
    title: 'Delete task?',
    text: `“${t.title}” will be removed from this list and the change committed to GitHub.`,
    confirmText: 'Delete', danger: true,
  });
  if (!ok) return;
  list.doc.tasks = list.doc.tasks.filter((x) => x.id !== id);
  try {
    await commitList(list, `Delete task: ${t.title}`);
    render();
    toast('Task deleted', 'success');
  } catch (e) {
    await loadLists(state.repo).catch(() => {});
    render();
    toast(e.message, 'error');
  }
}

/* ---------------------------------------------------------------- modals */
function openModalRaw(inner) {
  modalRoot.innerHTML = `<div class="modal-overlay">${inner}</div>`;
  const overlay = $('.modal-overlay', modalRoot);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  // Belt and braces: bind each injected form directly too. Idempotent via the
  // __gtHandled flag so the document-level handler cannot double-fire.
  $$('form', modalRoot).forEach((form) => {
    form.addEventListener('submit', (e) => handleFormSubmit(form, e), true);
  });
}

function closeModal() {
  modalRoot.innerHTML = '';
  if (confirmResolver) { confirmResolver(false); confirmResolver = null; }
}

function openTaskModal(id) {
  const list = activeList();
  if (!list) return;
  const t = id ? list.doc.tasks.find((x) => x.id === id) : null;
  const selectedPath = t ? list.path : state.activePath;
  const options = state.lists.map((l) =>
    `<option value="${esc(l.path)}" ${l.path === selectedPath ? 'selected' : ''}>${esc(l.name)}</option>`
  ).join('');
  openModalRaw(`
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${t ? 'Edit task' : 'Add task'}</h2><button class="icon-btn" data-action="close-modal">${icon('x')}</button></div>
      <form id="task-form" novalidate onsubmit="return false">
        <input type="hidden" name="id" value="${t ? esc(t.id) : ''}">
        <div class="field"><label class="field-label" for="f-title">Task</label>
          <input class="input" id="f-title" name="title" value="${esc(t ? t.title : '')}" placeholder="What needs doing?" autocomplete="off"></div>
        <div class="grid-2">
          <div class="field"><label class="field-label" for="f-due">Due date</label>
            <input class="input" type="date" id="f-due" name="due" value="${esc(t ? t.due : '')}"></div>
          <div class="field"><label class="field-label" for="f-path">List</label>
            <select class="select" id="f-path" name="path">${options}</select></div>
        </div>
        <div class="field"><label class="field-label" for="f-link">Link (optional)</label>
          <input class="input" type="url" id="f-link" name="link" value="${esc(t ? t.link : '')}" placeholder="https://example.com"></div>
        <div class="field"><label class="field-label" for="f-desc">Description (optional)</label>
          <textarea class="textarea" id="f-desc" name="desc" placeholder="Add a little more detail…">${esc(t ? t.desc : '')}</textarea></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="button" class="btn btn-primary" data-action="save-task">${t ? 'Save changes' : 'Add task'}</button>
        </div>
      </form>
    </div>`);
  setTimeout(() => $('#f-title')?.focus(), 0);
}

function openMoveModal(id) {
  const list = activeList();
  const t = list?.doc.tasks.find((x) => x.id === id);
  if (!t) return;
  const options = state.lists.map((l) => `
    <button class="move-option ${l.path === list.path ? 'current' : ''}" data-action="move-to" data-id="${esc(id)}" data-path="${esc(l.path)}">
      ${icon('list', 16)} <span>${esc(l.name)}</span>
    </button>`).join('');
  openModalRaw(`
    <div class="modal" role="dialog" aria-modal="true" style="max-width:400px">
      <div class="modal-head"><h2>Move task</h2><button class="icon-btn" data-action="close-modal">${icon('x')}</button></div>
      <div class="modal-body">
        <p class="field-hint" style="margin-bottom:14px">“${esc(t.title)}” →</p>
        <div class="move-list">${options}</div>
      </div>
    </div>`);
}

function openNewListModal() {
  openModalRaw(`
    <div class="modal" role="dialog" aria-modal="true" style="max-width:440px">
      <div class="modal-head"><h2>New list</h2><button class="icon-btn" data-action="close-modal">${icon('x')}</button></div>
      <form id="new-list-form" novalidate onsubmit="return false">
        <div class="modal-body">
          <div class="field"><label class="field-label" for="nl-name">List name</label>
            <input class="input" id="nl-name" name="name" placeholder="e.g. Groceries" autocomplete="off">
            <span class="field-hint">Creates a new <code>.md</code> file in the repository.</span></div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="button" class="btn btn-primary" data-action="create-list">Create list</button>
          </div>
        </div>
      </form>
    </div>`);
  setTimeout(() => $('#nl-name')?.focus(), 0);
}

/* -------------------------------------------------------------- renders */
function renderLogin() {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-bg" aria-hidden="true"><div class="orb orb-1"></div><div class="orb orb-2"></div></div>
      <div class="auth-card">
        <div class="brand">
          <div class="brand-mark">${icon('checkSquare', 22)}</div>
          <div><div class="brand-name">Git<span>Tasks</span></div><div class="brand-tag">Todo lists that live in GitHub</div></div>
        </div>
        <h1>Connect to GitHub</h1>
        <p class="lead">Paste a Personal Access Token. Your lists are stored as Markdown files in any repository you choose.</p>
        <div id="login-error"></div>
        <form id="login-form" novalidate onsubmit="return false">
          <div class="field">
            <label class="field-label" for="pat">Personal access token</label>
            <div class="input-wrap">
              <input class="input" id="pat" name="pat" type="password" placeholder="ghp_••••••••••••••••••••" autocomplete="off" spellcheck="false">
              <button class="icon-btn" type="button" data-action="toggle-pat" aria-label="Show token">${icon('eye', 17)}</button>
            </div>
            <span class="field-hint">Stored only in this browser tab unless you opt to remember it.</span>
          </div>
          <label class="checkbox" style="margin:4px 0 18px"><input type="checkbox" id="remember" ${state.remember ? 'checked' : ''}> Remember token on this device</label>
          <button class="btn btn-primary btn-lg btn-block" type="button" data-action="connect" id="connect-btn">Connect to GitHub ${icon('arrowRight', 16)}</button>
        </form>
        <div class="token-steps">
          <div class="token-steps-head">${icon('info', 16)} How to get a token</div>
          <ol>
            <li>Go to <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-grained access tokens</a> on GitHub.</li>
            <li>Create a new token with <strong>Contents</strong> set to <strong>Read and write</strong> access.</li>
            <li>Set the token to access the repository you want GitTasks to use.</li>
            <li>Copy the token and store it somewhere secure — GitHub only shows it once.</li>
            <li>Paste it into the field above.</li>
          </ol>
          <p class="token-steps-foot">Using a classic token instead? Enable <code>repo</code> for private repos or <code>public_repo</code> for public repos.</p>
        </div>
        <p class="security-note">${icon('lock', 14)} <span>This app runs entirely in your browser. Your token talks directly to GitHub and is never sent anywhere else.</span></p>
      </div>
    </div>`;
}

function showLoginError(message) {
  const box = $('#login-error');
  if (box) box.innerHTML = `<div class="error-box">${icon('alert', 16)} <span>${esc(message)}</span></div>`;
}

function renderRepoPicker() {
  const cards = state.repos.map((r) => {
    const search = `${r.full_name} ${r.description || ''}`.toLowerCase();
    return `
      <button class="repo-card" data-action="open-repo" data-full-name="${esc(r.full_name)}" data-search="${esc(search)}">
        <span class="repo-card-icon">${icon('repo', 21)}</span>
        <span class="repo-card-main">
          <span class="repo-name-row">
            <span class="repo-name">${esc(r.name)}</span>
            ${r.private ? `<span class="private-badge" title="Private repository">${icon('lock', 11)} Private</span>` : ''}
          </span>
          <span class="repo-full">${esc(r.full_name)}</span>
          <span class="repo-desc">${esc(r.description || 'No description provided')}</span>
        </span>
        <span class="repo-card-meta"><span>${esc(relativeTime(r.updated_at))}</span>${icon('chevronRight', 17)}</span>
      </button>`;
  }).join('');

  const body = state.repos.length
    ? `<div class="repo-list" id="repo-list">${cards}</div>`
    : `<div class="empty-state"><div class="empty-icon">${icon('repo', 26)}</div><h3>No repositories found</h3><p>Your token may not have access to any repos. Check its scopes, or create one on GitHub.</p></div>`;

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left"><div class="brand">${icon('checkSquare', 22)} <span class="brand-name">Git<span>Tasks</span></span></div></div>
        <div class="topbar-right">
          <span class="user-chip">${state.user?.avatar ? `<img src="${esc(state.user.avatar)}" alt="">` : ''}<span>${esc(state.user?.login || '')}</span></span>
          <span class="topbar-divider"></span>
          <button class="icon-btn" data-action="theme" title="Toggle theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18)}</button>
          <button class="icon-btn" data-action="logout" title="Sign out">${icon('logout', 18)}</button>
        </div>
      </header>
      <main class="repo-page">
        <div class="repo-page-head">
          <h1>Choose a repository</h1>
          <p class="muted">Select the repo where your Markdown todo lists live.</p>
          <div class="search-wrap">
            ${icon('search', 18)}
            <input class="input" id="repo-search" type="search" placeholder="Search repositories by name…" autocomplete="off" value="${esc(state.repoFilter)}">
            <span class="search-count" id="repo-count">${state.repos.length} repo${state.repos.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        ${body}
      </main>
    </div>`;
  filterRepos(state.repoFilter);
}

function filterRepos(query) {
  const q = query.trim().toLowerCase();
  let shown = 0;
  $$('.repo-card').forEach((card) => {
    const ok = !q || (card.dataset.search || '').includes(q);
    card.classList.toggle('hidden', !ok);
    if (ok) shown++;
  });
  const count = $('#repo-count');
  if (count) count.textContent = `${shown} repo${shown === 1 ? '' : 's'}`;
}

function taskCardHTML(t) {
  const due = dueInfo(t.due);
  const url = safeUrl(t.link);
  const saving = state.saving.has(t.id);
  return `
    <article class="task-card ${t.completed ? 'is-done' : ''} ${due?.cls === 'overdue' && !t.completed ? 'is-overdue' : ''} ${saving ? 'is-saving' : ''}">
      <button class="task-check ${t.completed ? 'checked' : ''}" data-action="toggle-task" data-id="${esc(t.id)}" ${saving ? 'disabled' : ''} aria-label="${saving ? 'Saving' : (t.completed ? 'Reopen' : 'Complete')} task">${saving ? `<span class="spin">${icon('spinner', 13)}</span>` : (t.completed ? icon('check', 13) : '')}</button>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.desc ? `<div class="task-desc">${esc(t.desc)}</div>` : ''}
        ${(t.due || url) ? `<div class="task-meta">
          ${t.due ? `<span class="badge due ${due?.cls || ''}">${icon('calendar', 13)} ${esc(t.due)}${due?.label ? ` · ${esc(due.label)}` : ''}</span>` : ''}
          ${url ? `<a class="badge link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('link', 13)} Open link ${icon('external', 11)}</a>` : ''}
        </div>` : ''}
      </div>
      <div class="task-actions">
        <button class="icon-btn sm" data-action="edit-task" data-id="${esc(t.id)}" ${saving ? 'disabled' : ''} title="Edit">${icon('pencil', 15)}</button>
        <button class="icon-btn sm" data-action="move-task" data-id="${esc(t.id)}" ${saving ? 'disabled' : ''} title="Move to list">${icon('arrowRight', 15)}</button>
        <button class="icon-btn sm danger" data-action="delete-task" data-id="${esc(t.id)}" ${saving ? 'disabled' : ''} title="Delete">${icon('trash', 15)}</button>
      </div>
    </article>`;
}

function renderBoard() {
  const list = activeList();
  if (!list) {
    app.innerHTML = `
      <div class="app-shell board-shell">
        <header class="topbar">
          <div class="topbar-left"><div class="brand">${icon('checkSquare', 22)} <span class="brand-name">Git<span>Tasks</span></span></div><span class="crumb"><span class="sep">/</span><strong>${esc(state.repo.full_name)}</strong></span></div>
          <div class="topbar-right">
            <span class="user-chip">${state.user?.avatar ? `<img src="${esc(state.user.avatar)}" alt="">` : ''}<span>${esc(state.user?.login || '')}</span></span>
            <button class="icon-btn" data-action="sync" title="Sync with GitHub">${icon('refresh', 18)}</button>
            <button class="icon-btn" data-action="theme" title="Toggle theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18)}</button>
            <button class="icon-btn" data-action="back-repos" title="Change repository">${icon('chevronLeft', 18)}</button>
            <button class="icon-btn" data-action="logout" title="Sign out">${icon('logout', 18)}</button>
          </div>
        </header>
        <div class="board-body">
          <aside class="sidebar"><div class="sidebar-head"><span>Lists</span><button class="icon-btn sm" data-action="new-list" title="New list">${icon('plus', 17)}</button></div><nav class="list-nav"></nav></aside>
          <main class="board-main">
            <div class="empty-state" style="max-width:520px">
              <div class="empty-icon">${icon('list', 26)}</div>
              <h3>No lists in this repository</h3>
              <p>Add a <code>.md</code> file to the repo, or create one here to start tracking tasks.</p>
              <button class="btn btn-primary" style="margin-top:18px" data-action="new-list">${icon('plus', 16)} Create a list</button>
            </div>
          </main>
        </div>
      </div>`;
    return;
  }
  const open = list.doc.tasks.filter((t) => !t.completed);
  const done = list.doc.tasks.filter((t) => t.completed);

  const listItems = state.lists.map((l) => {
    const count = l.doc.tasks.filter((t) => !t.completed).length;
    return `<button class="list-item ${l.path === list.path ? 'active' : ''}" data-action="select-list" data-path="${esc(l.path)}">
      <span class="li-icon">${icon(l.name.toLowerCase().startsWith(GENERAL_TITLE.toLowerCase()) ? 'star' : 'list', 16)}</span>
      <span class="li-name">${esc(l.name)}</span>
      ${count ? `<span class="li-count">${count}</span>` : ''}
    </button>`;
  }).join('');

  const openHTML = open.length
    ? open.map(taskCardHTML).join('')
    : `<div class="empty-state" style="padding:40px"><div class="empty-icon">${icon('checkSquare', 24)}</div><h3>Nothing to do</h3><p>Add your first task to get moving.</p></div>`;
  const doneHTML = done.length
    ? done.map(taskCardHTML).join('')
    : `<div class="empty-state" style="padding:26px"><p>No completed tasks yet.</p></div>`;

  app.innerHTML = `
    <div class="app-shell board-shell">
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand">${icon('checkSquare', 22)} <span class="brand-name">Git<span>Tasks</span></span></div>
          <span class="crumb"><span class="sep">/</span><strong>${esc(state.repo.full_name)}</strong></span>
        </div>
        <div class="topbar-right">
          <button class="icon-btn" data-action="sync" title="Sync with GitHub">${icon('refresh', 18)}</button>
          <span class="user-chip">${state.user?.avatar ? `<img src="${esc(state.user.avatar)}" alt="">` : ''}<span>${esc(state.user?.login || '')}</span></span>
          <span class="topbar-divider"></span>
          <button class="icon-btn" data-action="theme" title="Toggle theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18)}</button>
          <button class="icon-btn" data-action="back-repos" title="Change repository">${icon('chevronLeft', 18)}</button>
          <button class="icon-btn" data-action="logout" title="Sign out">${icon('logout', 18)}</button>
        </div>
      </header>
      <div class="board-body">
        <aside class="sidebar">
          <div class="sidebar-head"><span>Lists</span><button class="icon-btn sm" data-action="new-list" title="New list">${icon('plus', 17)}</button></div>
          <nav class="list-nav">${listItems}</nav>
          <div class="sidebar-foot">${state.lists.length} list${state.lists.length === 1 ? '' : 's'} in this repository · v${APP_VERSION}</div>
        </aside>
        <main class="board-main">
          ${state.error ? `<div class="error-box" style="margin-bottom:22px">${icon('alert', 16)} <span style="flex:1">${esc(state.error)}</span><button class="icon-btn sm" data-action="dismiss-error" aria-label="Dismiss">${icon('x', 14)}</button></div>` : ''}
          <div class="list-header">
            <div>
              <h1>${esc(list.name)}</h1>
              <div class="subtitle">${open.length} open · ${done.length} completed &nbsp;·&nbsp; <code>${esc(list.path)}</code></div>
            </div>
            <div class="header-actions"><button class="btn btn-primary" data-action="add-task">${icon('plus', 16)} Add task</button></div>
          </div>
          <section class="task-section">
            <h2 class="section-title">Todo <span class="count">${open.length}</span></h2>
            <div class="task-list">${openHTML}</div>
          </section>
          <section class="task-section completed-section">
            <h2 class="section-title">Completed <span class="count">${done.length}</span>
              ${done.length ? `<button class="icon-btn sm section-toggle" data-action="toggle-completed" title="${state.completedCollapsed ? 'Show' : 'Hide'} completed">${icon(state.completedCollapsed ? 'chevronDown' : 'chevronLeft', 15)}</button>` : ''}
            </h2>
            ${state.completedCollapsed ? '' : `<div class="task-list">${doneHTML}</div>`}
          </section>
        </main>
      </div>
    </div>`;
}

function render() {
  if (state.view === 'login') renderLogin();
  else if (state.view === 'repos') renderRepoPicker();
  else if (state.view === 'board') renderBoard();
}

/* ---------------------------------------------------------------- events */
async function onLogin(form) {
  const token = String(new FormData(form).get('pat') || '').trim();
  if (!token) { showLoginError('Paste a Personal Access Token to continue.'); $('#pat')?.focus(); return; }
  state.token = token;
  state.remember = !!$('#remember')?.checked;
  saveToken();
  const btn = $('#connect-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = `${icon('spinner', 17)} Connecting…`; }
  try {
    await connect();
  } catch (e) {
    clearToken();
    state.token = '';
    state.client = null;
    render();
    showLoginError(e.message);
  }
}

function handleFormSubmit(form, e) {
  if (!form || form.tagName !== 'FORM') return;
  if (e.__gtHandled) return;
  e.__gtHandled = true;
  // Capture-phase prevention: stop the browser's default GET navigation even
  // if another handler stops propagation later in the event's lifecycle.
  e.preventDefault();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();

  if (form.id === 'login-form') onLogin(form);
  else if (form.id === 'task-form') onSaveTask(form);
  else if (form.id === 'new-list-form') {
    const name = String(new FormData(form).get('name') || '').trim();
    if (name) { closeModal(); createList(name).catch((err) => reportError(err)); }
  }
}

// Capture on document so every form is covered, including ones injected into
// #modal-root after this listener was registered.
document.addEventListener('submit', (e) => handleFormSubmit(e.target, e), true);

document.addEventListener('input', (e) => {
  if (e.target.id === 'repo-search') {
    state.repoFilter = e.target.value;
    filterRepos(state.repoFilter);
  }
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, path, fullName } = el.dataset;
  switch (action) {
    case 'toggle-pat': {
      const input = $('#pat');
      if (!input) break;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      el.innerHTML = icon(show ? 'eyeOff' : 'eye', 17);
      break;
    }
    case 'theme': toggleTheme(); break;
    case 'logout': doLogout(); break;
    case 'open-repo': doOpenRepo(fullName); break;
    case 'back-repos': state.view = 'repos'; state.repo = null; render(); break;
    case 'sync': onSync(); break;
    case 'new-list': openNewListModal(); break;
    case 'select-list': state.activePath = path; render(); break;
    case 'add-task': openTaskModal(null); break;
    case 'edit-task': openTaskModal(id); break;
    case 'move-task': openMoveModal(id); break;
    case 'move-to': onMoveTo(id, path); break;
    case 'delete-task': onDeleteTask(id); break;
    case 'toggle-task': onToggleTask(id); break;
    case 'toggle-completed': state.completedCollapsed = !state.completedCollapsed; render(); break;
    case 'close-modal': closeModal(); break;
    case 'confirm-yes': if (confirmResolver) { confirmResolver(true); confirmResolver = null; } closeModal(); break;
    case 'confirm-no': closeModal(); break;
    case 'dismiss-toast': el.closest('.toast')?.remove(); break;
    case 'dismiss-error': state.error = ''; render(); break;
    case 'connect': { const form = $('#login-form'); if (form) onLogin(form); break; }
    case 'save-task': { const form = $('#task-form'); if (form) onSaveTask(form); break; }
    case 'create-list': {
      const name = String($('#nl-name')?.value || '').trim();
      if (name) { closeModal(); createList(name).catch((err) => reportError(err)); }
      break;
    }
    default: break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalRoot.innerHTML) closeModal();
});

// Surface anything unexpected instead of letting it vanish into the console.
window.addEventListener('unhandledrejection', (e) => {
  reportError((e.reason && e.reason.message) || e.reason || 'Unknown error');
  e.preventDefault();
});

/* ------------------------------------------------------------------ boot */
(async function boot() {
  const stored = localStorage.getItem('gittasks-token') || sessionStorage.getItem('gittasks-token');
  if (!stored) { render(); return; }
  state.token = stored;
  state.remember = !!localStorage.getItem('gittasks-token');
  try {
    await connect();
  } catch (e) {
    clearToken();
    state.token = '';
    render();
    showLoginError(e.message);
  }
})();
