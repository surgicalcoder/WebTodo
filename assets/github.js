// Thin GitHub REST API wrapper. All calls are made directly from the browser
// with the user's PAT — no server component.
const API = 'https://api.github.com';

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob((b64 || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function pathSegments(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

export class GitHubClient {
  constructor(token) {
    this.token = token;
  }

  async request(path, options = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        method: options.method || 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (e) {
      throw new Error('Network error — could not reach GitHub. Check your connection.');
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      let msg = (data && data.message) || `GitHub API error (${res.status})`;
      if (res.status === 401) msg = 'Bad credentials — check your Personal Access Token.';
      if (res.status === 403) {
        msg = (data && data.message && /rate limit/i.test(data.message))
          ? 'GitHub API rate limit reached. Try again later.'
          : ((data && data.message) || 'Access forbidden — your token may lack the required scopes.');
      }
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return { data, headers: res.headers };
  }

  async verify() {
    const { data } = await this.request('/user');
    return { login: data.login, name: data.name, avatar: data.avatar_url };
  }

  async listRepos() {
    let all = [];
    let page = 1;
    while (page <= 10) {
      const q = '/user/repos'
        + '?per_page=100'
        + `&page=${page}`
        + '&sort=updated'
        + '&affiliation=owner,collaborator,organization_member';
      const { data, headers } = await this.request(q);
      all = all.concat(data || []);
      const link = headers.get('link') || '';
      if (!/rel="next"/.test(link)) break;
      page++;
    }
    return all;
  }

  // Returns all .md blobs in the repo (recursive). Falls back to root contents
  // if the tree is truncated.
  async listMarkdownFiles(owner, repo, branch) {
    const { data } = await this.request(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
    );
    if (!data.truncated) {
      return (data.tree || [])
        .filter((f) => f.type === 'blob' && f.path.toLowerCase().endsWith('.md'))
        .map((f) => ({ path: f.path, sha: f.sha }));
    }
    const { data: root } = await this.request(
      `/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(branch)}`
    );
    return (root || [])
      .filter((f) => f.type === 'file' && f.name.toLowerCase().endsWith('.md'))
      .map((f) => ({ path: f.path, sha: f.sha }));
  }

  async getFile(owner, repo, path, branch) {
    const { data } = await this.request(
      `/repos/${owner}/${repo}/contents/${pathSegments(path)}?ref=${encodeURIComponent(branch)}`
    );
    return { content: base64ToUtf8(data.content || ''), sha: data.sha };
  }

  async putFile(owner, repo, path, content, sha, message, branch) {
    const body = {
      message: message || 'Update todo list',
      content: utf8ToBase64(content),
      branch,
    };
    if (sha) body.sha = sha;
    const { data } = await this.request(
      `/repos/${owner}/${repo}/contents/${pathSegments(path)}`,
      { method: 'PUT', body }
    );
    return { sha: data && data.content && data.content.sha };
  }
}
