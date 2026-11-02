/** OAuth helpers use Web Crypto and Fetch APIs supported by Pages Functions. */
export const COOKIE = '__Host-jcs-oauth';
const encoder = new TextEncoder();
export function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
export function random() { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export async function challenge(verifier) { return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))); }
async function key(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signSession(session, secret) {
  const payload = base64url(encoder.encode(JSON.stringify(session)));
  const signature = base64url(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)));
  return `${payload}.${signature}`;
}
export async function readSession(value, secret) {
  try {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) return null;
    if (!await crypto.subtle.verify('HMAC', await key(secret), decode(signature), encoder.encode(payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (typeof data.expires !== 'number' || data.expires < Date.now() || !/^[\w-]{43}$/.test(data.state) || !/^[\w-]{43}$/.test(data.verifier)) return null;
    return data;
  } catch { return null; }
}
export function cookie(value, maxAge = 600) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function configuration(env, request) {
  for (const name of ['SITE_ORIGIN', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'OAUTH_COOKIE_SECRET', 'GITHUB_REPO', 'ALLOWED_GITHUB_USERS']) {
    if (!env[name]) throw new Error('CMS authentication is not configured.');
  }
  const url = new URL(env.SITE_ORIGIN);
  if (url.protocol !== 'https:' || url.origin !== env.SITE_ORIGIN || new URL(request.url).origin !== url.origin || env.OAUTH_COOKIE_SECRET.length < 32) {
    throw new Error('CMS authentication configuration is invalid.');
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPO)) throw new Error('Invalid repository.');
  const scope = env.GITHUB_SCOPE || 'public_repo';
  if (!['public_repo', 'repo'].includes(scope)) throw new Error('Invalid GitHub scope.');
  const users = env.ALLOWED_GITHUB_USERS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!users.length) throw new Error('No allowed editors.');
  return { origin: url.origin, callback: `${url.origin}/api/callback`, scope, users };
}
export function headers(extra = {}) {
  return {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}
export function failure(message, status = 400, clearCookie = false) {
  return new Response(message, { status, headers: headers({
    'Content-Type': 'text/plain; charset=utf-8',
    ...(clearCookie ? { 'Set-Cookie': cookie('', 0) } : {}),
  }) });
}

/** Decap's popup handshake. Only the exact configured opener origin receives the token. */
export function popup(origin, token) {
  const nonce = random();
  const literal = value => JSON.stringify(value).replace(/</g, '\\u003c');
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CMS sign-in</title></head><body><p>Completing sign-in. Return to the menu editor.</p><script nonce="${nonce}">
  const origin = ${literal(origin)};
  const openerWindow = window.opener;
  if (openerWindow) {
    function receive(event) {
      if (event.origin !== origin || event.source !== openerWindow || event.data !== 'authorizing:github') return;
      window.removeEventListener('message', receive);
      openerWindow.postMessage(${literal('authorization:github:success:' + JSON.stringify({ token, provider: 'github' }))}, origin);
      window.close();
    }
    window.addEventListener('message', receive);
    openerWindow.postMessage('authorizing:github', origin);
    setTimeout(() => window.close(), 60000);
  }
  </script></body></html>`;
  return new Response(body, { headers: headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Set-Cookie': cookie('', 0),
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    // Do not set COOP same-origin: it would sever GitHub's popup opener.
    'Cross-Origin-Opener-Policy': 'unsafe-none',
  }) });
}
