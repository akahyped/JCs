import { COOKIE, configuration, readSession, popup, failure } from '../../lib/oauth.js';

export async function onRequestGet({ request, env }) {
  let config;
  try { config = configuration(env, request); }
  catch { return failure('CMS login is not configured for this hostname.', 503, true); }
  const url = new URL(request.url);
  const value = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const session = value && await readSession(value, env.OAUTH_COOKIE_SECRET);
  if (!session || !url.searchParams.get('state') || session.state !== url.searchParams.get('state')) {
    return failure('Sign-in expired or could not be verified. Close this window and log in again.', 400, true);
  }
  if (url.searchParams.has('error')) return failure('GitHub sign-in was canceled. Close this window and try again.', 400, true);
  const code = url.searchParams.get('code');
  if (!code || code.length > 512) return failure('Missing authorization code.', 400, true);
  let token;
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
        code, redirect_uri: config.callback, code_verifier: session.verifier }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json();
    token = payload.access_token;
    if (!response.ok || !token || payload.error) throw new Error('Token exchange failed.');
    const options = {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'JCs-Decap-OAuth' },
      signal: AbortSignal.timeout(15000),
    };
    const userResponse = await fetch('https://api.github.com/user', options);
    if (!userResponse.ok) throw new Error('User lookup failed.');
    const user = await userResponse.json();
    if (!config.users.includes(String(user.login).toLowerCase())) throw new Error('Not an editor.');
    const repoResponse = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}`, options);
    if (!repoResponse.ok || !(await repoResponse.json()).permissions?.push) throw new Error('Repository write permission required.');
    return popup(config.origin, token);
  } catch {
    // Do not log authorization codes, credentials, token responses, or access tokens.
    // Revoke a newly issued token that cannot be delivered to an authorized editor.
    if (token) {
      try {
        await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
          method: 'DELETE',
          headers: { Authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
            Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'JCs-Decap-OAuth' },
          body: JSON.stringify({ access_token: token }), signal: AbortSignal.timeout(5000),
        });
      } catch { /* GitHub may be unavailable; do not expose the token. */ }
    }
    return failure('Sign-in failed. Confirm your GitHub account is an allowed editor with write access to the restaurant repository, then try again.', 403, true);
  }
}
