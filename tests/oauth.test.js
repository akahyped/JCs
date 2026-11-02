import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as auth } from '../functions/api/auth.js';
import { onRequestGet as callback } from '../functions/api/callback.js';
import { COOKIE, signSession, readSession, random, popup } from '../lib/oauth.js';
const env = { SITE_ORIGIN: 'https://restaurant.example', GITHUB_REPO: 'owner/restaurant',
  GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'not-a-real-secret',
  OAUTH_COOKIE_SECRET: 'test-only-cookie-secret-with-at-least-32-characters', ALLOWED_GITHUB_USERS: 'owner' };
const request = path => new Request(env.SITE_ORIGIN + path);

test('login creates secure signed cookie and PKCE, ignores caller-controlled redirect', async () => {
  const res = await auth({ request: request('/api/auth?provider=github&site_id=evil.test'), env });
  assert.equal(res.status, 302);
  const url = new URL(res.headers.get('Location'));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('redirect_uri'), env.SITE_ORIGIN + '/api/callback');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge').length, 43);
  assert.match(res.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax/);
});
test('missing setup and preview origin fail closed', async () => {
  assert.equal((await auth({ request: request('/api/auth?provider=github'), env: {} })).status, 503);
  assert.equal((await auth({ request: new Request('https://preview.example/api/auth?provider=github'), env })).status, 503);
});
test('invalid state, missing cookie, and forged or expired sessions fail before network access', async () => {
  assert.equal((await callback({ request: request('/api/callback?code=abc&state=x'), env })).status, 400);
  const expired = await signSession({ state: random(), verifier: random(), expires: 0 }, env.OAUTH_COOKIE_SECRET);
  assert.equal(await readSession(expired, env.OAUTH_COOKIE_SECRET), null);
  const valid = await signSession({ state: random(), verifier: random(), expires: Date.now() + 60000 }, env.OAUTH_COOKIE_SECRET);
  assert.equal(await readSession(valid + 'x', env.OAUTH_COOKIE_SECRET), null);
});
test('popup is origin-bound, source-bound, script-escaped, and never cached', async () => {
  const response = popup(env.SITE_ORIGIN, '</script><script>bad</script>');
  const html = await response.text();
  assert.ok(html.includes('event.origin !== origin'));
  assert.ok(html.includes('event.source !== openerWindow'));
  assert.ok(!html.includes('</script><script>bad'));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Security-Policy'), /nonce-/);
});
test('callback exchanges code, verifies editor and repository write permission, and denies other editors', async () => {
  const realFetch = globalThis.fetch;
  const state = random();
  const value = await signSession({ state, verifier: random(), expires: Date.now() + 60000 }, env.OAUTH_COOKIE_SECRET);
  const req = () => new Request(`${env.SITE_ORIGIN}/api/callback?state=${state}&code=example-code`, { headers: { Cookie: `${COOKIE}=${value}` } });
  let user = 'owner'; let canPush = true; const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    if (url.includes('/access_token')) return Response.json({ access_token: 'test-token' });
    if (url.endsWith('/user')) return Response.json({ login: user });
    if (url.includes('/repos/')) return Response.json({ permissions: { push: canPush } });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error('Unexpected network request');
  };
  try {
    let response = await callback({ request: req(), env });
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('authorization:github:success:'));
    assert.ok(calls[0][1].body.get('code_verifier'));
    user = 'stranger';
    response = await callback({ request: req(), env });
    assert.equal(response.status, 403);
    assert.ok(!(await response.text()).includes('test-token'));
    assert.ok(calls.some(([, opts]) => opts.method === 'DELETE'));
    user = 'owner'; canPush = false;
    assert.equal((await callback({ request: req(), env })).status, 403);
  } finally { globalThis.fetch = realFetch; }
});
