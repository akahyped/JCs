import { configuration, random, challenge, signSession, cookie, headers, failure } from '../../lib/oauth.js';

export async function onRequestGet({ request, env }) {
  let config;
  try { config = configuration(env, request); }
  catch { return failure('CMS login is not configured for this hostname. Contact the site administrator.', 503); }
  const incoming = new URL(request.url);
  if (incoming.searchParams.get('provider') !== 'github') return failure('Unsupported login provider.');
  const origin = request.headers.get('Origin');
  if (origin && origin !== config.origin) return failure('Origin not allowed.', 403);
  const state = random();
  const verifier = random();
  const session = await signSession({ state, verifier, expires: Date.now() + 600000 }, env.OAUTH_COOKIE_SECRET);
  const destination = new URL('https://github.com/login/oauth/authorize');
  destination.search = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: config.callback,
    scope: config.scope,
    state,
    code_challenge: await challenge(verifier),
    code_challenge_method: 'S256',
    allow_signup: 'false',
  }).toString();
  return new Response(null, { status: 302, headers: headers({ Location: destination.href, 'Set-Cookie': cookie(session) }) });
}
