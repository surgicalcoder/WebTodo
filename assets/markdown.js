// Todo-list Markdown format.
//
// # List name
//
// ## Todo
//
// - [ ] Task title <!--{"due":"2026-11-20","link":"https://...","desc":"..."}-->
//
// ## Completed
//
// - [x] Done task
//
// Metadata lives in a trailing HTML comment as compact JSON: invisible when
// GitHub renders the file, exact for round-tripping. Unknown keys (e.g. future
// repeat fields) are preserved. All dates are stored as yyyy-MM-dd.

export const GENERAL_TITLE = 'General';

export function defaultListContent(name = GENERAL_TITLE) {
  return `# ${name}\n\n## Todo\n\n## Completed\n`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASK_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const COMMENT_RE = /<!--\s*([\s\S]*?)\s*-->\s*$/;
const H1_RE = /^#\s+(.+?)\s*$/;
const H2_RE = /^##\s+(.+?)\s*$/;

function classifyHeading(heading) {
  const s = heading.trim().toLowerCase();
  if (s === 'todo' || s === 'to do' || s === 'to-do' || s.startsWith('todo ')) return 'todo';
  if (s === 'completed' || s === 'done' || s === 'complete' || s.startsWith('completed ')) return 'completed';
  return 'other';
}

export function makeId() {
  return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function parseTasks(lines, sectionCompleted, out) {
  for (const line of lines) {
    const m = line.match(TASK_RE);
    if (!m) continue;

    let body = m[2];
    let meta = {};
    const cm = body.match(COMMENT_RE);
    if (cm) {
      try {
        const parsed = JSON.parse(cm[1]);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          meta = parsed;
          body = body.slice(0, cm.index).trimEnd();
        }
      } catch {
        // Malformed comment — leave it as part of the title.
      }
    }
    body = body.trim();
    if (!body) continue;

    out.push({
      id: makeId(),
      title: body,
      completed: sectionCompleted || m[1].toLowerCase() === 'x',
      due: DATE_RE.test(meta.due) ? meta.due : '',
      link: typeof meta.link === 'string' ? meta.link : '',
      desc: typeof meta.desc === 'string' ? meta.desc : '',
      meta,
    });
  }
}

export function parseDocument(content, fallbackName = GENERAL_TITLE) {
  const lines = (content || '').replace(/\r\n?/g, '\n').split('\n');
  let title = fallbackName;
  const preamble = [];
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const h1 = line.match(H1_RE);
    if (h1 && !current) { title = h1[1]; continue; }
    const h2 = line.match(H2_RE);
    if (h2) {
      current = { heading: h2[1], kind: classifyHeading(h2[1]), lines: [] };
      blocks.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }

  const tasks = [];
  const todo = blocks.find((b) => b.kind === 'todo');
  const completed = blocks.find((b) => b.kind === 'completed');
  if (todo) parseTasks(todo.lines, false, tasks);
  if (completed) parseTasks(completed.lines, true, tasks);

  return { title, preamble, blocks, tasks };
}

function renderTask(task) {
  const meta = { ...(task.meta || {}) };
  delete meta.due;
  delete meta.link;
  delete meta.desc;
  if (task.due) meta.due = task.due;
  if (task.link) meta.link = task.link;
  if (task.desc) meta.desc = task.desc;
  const keys = Object.keys(meta);
  const comment = keys.length ? ` <!--${JSON.stringify(meta)}-->` : '';
  return `- [${task.completed ? 'x' : ' '}] ${task.title}${comment}`;
}

function trimBlank(lines) {
  const copy = lines.slice();
  while (copy.length && !copy[0].trim()) copy.shift();
  while (copy.length && !copy[copy.length - 1].trim()) copy.pop();
  return copy;
}

export function serializeDocument(doc) {
  const out = [`# ${doc.title || GENERAL_TITLE}`];
  const pre = trimBlank(doc.preamble);
  if (pre.length) out.push('', ...pre);

  const blocks = doc.blocks.slice();
  if (!blocks.some((b) => b.kind === 'todo')) {
    blocks.unshift({ kind: 'todo', heading: 'Todo', lines: [] });
  }
  if (!blocks.some((b) => b.kind === 'completed')) {
    blocks.push({ kind: 'completed', heading: 'Completed', lines: [] });
  }

  for (const block of blocks) {
    out.push('', `## ${block.heading}`, '');
    if (block.kind === 'todo') {
      for (const t of doc.tasks.filter((t) => !t.completed)) out.push(renderTask(t));
    } else if (block.kind === 'completed') {
      for (const t of doc.tasks.filter((t) => t.completed)) out.push(renderTask(t));
    } else {
      const ls = trimBlank(block.lines);
      if (ls.length) out.push(...ls);
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
