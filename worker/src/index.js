const json = (data, status = 200, origin = '*') => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'cache-control': 'no-store',
    'vary': 'Origin'
  }
});

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function allowed(request, env) {
  return request.headers.get('Origin') === env.ALLOWED_ORIGIN;
}

async function githubRequest(env, method, body) {
  const path = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE}`;
  return fetch(path, {
    method,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'spain-paris-notices-worker',
      'x-github-api-version': '2022-11-28'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

async function readEntries(env) {
  const response = await githubRequest(env, 'GET');
  if (response.status === 404) return { entries: [], sha: null };
  if (!response.ok) throw new Error('GitHub read failed');
  const file = await response.json();
  const parsed = JSON.parse(decodeBase64Utf8(file.content));
  return { entries: Array.isArray(parsed.entries) ? parsed.entries : [], sha: file.sha };
}

async function verifyTurnstile(token, request, env) {
  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true && (!result.hostname || result.hostname === 'commulgosu.github.io');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') {
      if (origin !== env.ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        'access-control-allow-origin': env.ALLOWED_ORIGIN,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
        vary: 'Origin'
      }});
    }
    if (origin !== env.ALLOWED_ORIGIN) return json({ error: '허용되지 않은 사이트입니다.' }, 403);
    const url = new URL(request.url);
    if (url.pathname === '/api/config' && request.method === 'GET') {
      return json({ siteKey: env.TURNSTILE_SITE_KEY }, 200, env.ALLOWED_ORIGIN);
    }
    if (url.pathname === '/api/guestbook' && request.method === 'GET') {
      try {
        const { entries } = await readEntries(env);
        return json({ entries: entries.slice(0, 100) }, 200, env.ALLOWED_ORIGIN);
      } catch {
        return json({ error: '방명록을 불러오지 못했습니다.' }, 502, env.ALLOWED_ORIGIN);
      }
    }
    if (url.pathname !== '/api/guestbook' || request.method !== 'POST') {
      return json({ error: '찾을 수 없는 요청입니다.' }, 404, env.ALLOWED_ORIGIN);
    }
    let input;
    try { input = await request.json(); } catch {
      return json({ error: '요청 내용을 확인해 주세요.' }, 400, env.ALLOWED_ORIGIN);
    }
    if (typeof input.website === 'string' && input.website.trim()) {
      return json({ ok: true }, 200, env.ALLOWED_ORIGIN);
    }
    const author = typeof input.author === 'string' ? input.author.trim() : '';
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    const token = typeof input.turnstileToken === 'string' ? input.turnstileToken : '';
    if (author.length > 30 || body.length < 2 || body.length > 1500) {
      return json({ error: '닉네임과 메시지 길이를 확인해 주세요.' }, 400, env.ALLOWED_ORIGIN);
    }
    if (!token || !await verifyTurnstile(token, request, env)) {
      return json({ error: '봇 확인이 만료되었습니다. 다시 확인해 주세요.' }, 400, env.ALLOWED_ORIGIN);
    }
    const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), author: author || '익명', body };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const current = await readEntries(env);
        const nextEntries = [entry, ...current.entries].slice(0, 2000);
        const update = await githubRequest(env, 'PUT', {
          message: 'Add visitor guestbook entry',
          branch: env.GITHUB_BRANCH,
          content: encodeBase64Utf8(`${JSON.stringify({ entries: nextEntries }, null, 2)}\n`),
          ...(current.sha ? { sha: current.sha } : {})
        });
        if (update.ok) return json({ ok: true, entry }, 201, env.ALLOWED_ORIGIN);
        if (update.status !== 409 && update.status !== 422) throw new Error('GitHub write failed');
      } catch {
        if (attempt === 2) return json({ error: '방명록 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, 502, env.ALLOWED_ORIGIN);
      }
    }
    return json({ error: '동시에 등록된 글이 있어 저장하지 못했습니다. 다시 시도해 주세요.' }, 409, env.ALLOWED_ORIGIN);
  }
};
