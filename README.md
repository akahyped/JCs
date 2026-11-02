# JC’s Restaurant — Cloudflare Pages + Decap CMS

A single-page restaurant website with the original warm cream, olive, serif typography and burger hero. The entire public menu is rendered from `public/data/menu.json`; it is not duplicated in HTML. All public section navigation uses same-page anchors. Phone and directions links remain external actions.

**Delivery status:** implementation and automated checks are complete. This package has not been connected to your GitHub or Cloudflare accounts. Live CMS authentication and publishing require the account-specific setup below. Login deliberately fails closed until configured. Confirm the weekly opening hours and menu pricing with the restaurant before launch. The hero photograph is illustrative, not a photograph of JC’s food.

## Project map

| Path | Purpose |
| --- | --- |
| `public/index.html` | Public single-page website; no hardcoded menu items |
| `public/assets/css/styles.css` | Original visual design and responsive styles |
| `public/assets/js/menu.js` | Fetching, safe DOM rendering, search, photos, availability and anchor links |
| `public/assets/js/menu-model.js` | Shared menu validation, normalization and filtering |
| `public/assets/images/burger.jpg` | Locally hosted illustrative hero photograph |
| `public/data/menu.json` | Editable restaurant menu, seeded with 104 entries across 12 categories |
| `public/data/menu.schema.json` | JSON Schema for editor tooling; JS validation also checks unique IDs and meal references |
| `public/admin/index.html` | Decap CMS admin shell |
| `public/admin/config.yml` | GitHub backend and nested category/item editor |
| `public/admin/editor.js` | Validation hook before CMS saves |
| `functions/api/auth.js` | GitHub login initiation with state and PKCE |
| `functions/api/callback.js` | Code exchange, editor authorization and Decap popup handshake |
| `lib/oauth.js` | Signed cookie, origin restriction and popup security helpers |
| `public/_headers` | Public and admin security / cache headers |
| `public/_routes.json` | Only `/api/*` invokes Pages Functions |
| `scripts/check.mjs` | Content, anchor and local image checks |
| `tests/` | Menu rules and mocked OAuth tests; fixtures do not restrict owners' live menu edits |
| `.github/workflows/check.yml` | GitHub validation on pushes and pull requests |
| `.dev.vars.example` | Environment variable names; contains placeholders only |

There is no framework, database, runtime npm dependency or frontend build step. The `build` command validates content and runs tests, then Cloudflare serves `public/` directly. Pages Functions implement the small server-side OAuth component.

## 1. Put the project in GitHub

1. Extract this archive. Open the `jcs-cloudflare` folder in your editor.
2. Create a GitHub repository (for example `restaurant-owner/jcs-restaurant`) with default branch `main`. Do not initialize it with another README if using the commands below.
3. From this project folder:

   ```sh
   git init -b main
   git add .
   git commit -m "Create restaurant website and menu CMS"
   git remote add origin https://github.com/OWNER/REPOSITORY.git
   git push -u origin main
   ```

4. Invite each restaurant editor to this repository with **Write** access. Each editor needs their own GitHub account. Repository write permission is required by Decap's GitHub backend.
5. Use a restaurant-owned repository and OAuth app for handoff so your personal account is not the sole owner. Enable two-factor authentication for editors.

Do not commit real credentials, `.dev.vars`, `.env` or Cloudflare tokens. The supplied `.gitignore` excludes local secrets. Your GitHub repository contains all public menu data and photos; do not store customer or private business information in these files.

## 2. Create a Cloudflare Pages project

In Cloudflare, choose **Workers & Pages → Create application → Pages → Connect to Git**. Connect GitHub and select the repository. Use:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Production branch | `main` |
| Root directory | Repository root (leave blank) |
| Build command | `npm run build` |
| Build output directory | `public` |
| Node.js version | 22 or later; set `NODE_VERSION=22` if needed |

The root `functions/` directory is deployed automatically with Pages Git integration. Do not upload only `public/` using dashboard drag-and-drop: the OAuth Functions would be missing. Leave Functions in the repository root.

Make the first deployment, then record your actual `https://PROJECT.pages.dev` URL. Pick one canonical production origin for CMS login. It may instead be your final custom domain once Cloudflare has activated it.

## 3. Configure Decap's GitHub backend

Edit `public/admin/config.yml`:

```yaml
backend:
  name: github
  repo: restaurant-owner/jcs-restaurant
  branch: main
  base_url: https://YOUR-PROJECT.pages.dev
  auth_endpoint: api/auth
  auth_scope: public_repo

site_url: https://YOUR-PROJECT.pages.dev
display_url: https://YOUR-PROJECT.pages.dev
```

Replace the repository and all three origin placeholders with your actual values. Keep `api/auth` as written (no leading slash). The backend uses the same production origin as the site; a separate OAuth hosting service is not required.

For a **private repository**, change `auth_scope` to `repo` here and set `GITHUB_SCOPE=repo` in Cloudflare. For a public repository use `public_repo` in both places. GitHub OAuth scopes are broader than a single repository; use editor accounts whose repository access matches the restaurant's needs. This integration verifies the configured repository permission before handing a token to Decap, but does not convert GitHub's OAuth token into a repository-scoped credential.

Keep production on `main` with direct CMS publishing. A branch rule requiring all changes to arrive through pull requests will prevent this configuration from publishing. If your organization requires PR review, deliberately switch to Decap editorial workflow and document the extra review step before handing off the site.

## 4. Register a GitHub OAuth App

Open [GitHub Developer settings → OAuth Apps](https://github.com/settings/developers), choose **New OAuth App**, and enter:

| Field | Value |
| --- | --- |
| Application name | JC’s Restaurant Menu Editor |
| Homepage URL | `https://YOUR-PROJECT.pages.dev` |
| Authorization callback URL | `https://YOUR-PROJECT.pages.dev/api/callback` |

Use your actual canonical production origin in both URLs. Register the application, copy its Client ID, and generate a Client Secret. Store the secret only in Cloudflare's encrypted secret setting. Never paste it into `config.yml` or frontend JavaScript.

This client uses GitHub's normal web application OAuth flow. It does not request expiring tokens or implement refresh-token rotation. If your GitHub OAuth app forces expiring tokens, you will need to add refresh support or use a supported managed Decap auth provider; do not enable that option for this supplied integration. Editors can log out and authenticate again, and can revoke the app in GitHub settings.

## 5. Add Cloudflare variables and secrets

In your Pages project's **Settings → Variables and Secrets**, add the following for the **Production** environment. Names are case-sensitive.

| Name | Type | Example |
| --- | --- | --- |
| `SITE_ORIGIN` | Variable | `https://YOUR-PROJECT.pages.dev` (no trailing slash) |
| `GITHUB_REPO` | Variable | `restaurant-owner/jcs-restaurant` |
| `GITHUB_SCOPE` | Variable | `public_repo` (or `repo` for a private repository) |
| `GITHUB_CLIENT_ID` | Variable | Client ID from GitHub |
| `GITHUB_CLIENT_SECRET` | Encrypted secret | Client Secret from GitHub |
| `OAUTH_COOKIE_SECRET` | Encrypted secret | At least 32 random characters |
| `ALLOWED_GITHUB_USERS` | Variable | `owner-login,manager-login` |

Generate the cookie secret locally with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value directly to Cloudflare. The cookie secret signs only short-lived OAuth state, not menu content. Do not reuse the GitHub client secret for it.

`ALLOWED_GITHUB_USERS` contains **GitHub usernames**, not email addresses. An account must both appear in this list and have push permission for `GITHUB_REPO`. Configuration checks reject unexpected hostnames, including Cloudflare preview deployment origins. Use `/admin/` on the exact `SITE_ORIGIN` for sign-in. Production secrets need not be copied to Preview.

Commit and push the config changes, then trigger a new production deployment after adding the variables and secrets. Environment changes apply to new deployments.

## 6. Complete the live acceptance check

1. Open the deployed homepage and confirm its menu loads. Check on a phone as well as a desktop.
2. Open `https://YOUR-PROJECT.pages.dev/admin/`. Allow the GitHub sign-in popup.
3. Log in as an allowed GitHub user who has repository Write access. Confirm the editor opens.
4. Under **Restaurant → Menu**, make a small reversible change to an existing item description. Save / publish it.
5. Confirm the GitHub commit appears on `main`, Cloudflare's new production deployment succeeds, and the updated text appears after reloading the public page.
6. Restore the temporary description through the CMS and publish again.
7. Test an uploaded photo with alt text, an unavailable item and an unavailable category; restore them afterward.
8. Verify a GitHub account outside the allowlist is denied login. The included automated tests simulate this check; they do not substitute for the real account test.

Live GitHub authentication and publishing cannot be verified until you configure the real repository, OAuth app and Cloudflare secrets. The supplied code has tests for the token exchange and authorization paths using mocked GitHub responses.

## Owner guide: changing the menu

- Open `/admin/` on the canonical production site and sign in with GitHub.
- Open **Restaurant → Menu**.
- Expand **Menu categories**. Add a category, edit its name/description, choose its meal section, and optionally upload a photo.
- Expand a category's **Menu items** list. Add or edit a name, price, description and photo. Price is text so sizes and ranges can be entered, for example `Small $5.99 / Large $6.99`.
- Use list drag handles to reorder categories and items. Category order in the JSON determines their order within each meal section. Meal section order controls breakfast/lunch section order.
- To move an item to a different category, copy its values, remove it from the old category, and add it under the new one, retaining its unique ID.
- **Available off** leaves an item visible with “Currently unavailable.” Turning off category availability marks all items in that category unavailable as well.
- **Visible on website off** hides an item or an entire category without deleting it.
- Delete using the list's remove control. Deletions are retained in Git history but disappear from the current menu after publication.
- IDs must be unique, lowercase hyphenated slugs, e.g. `burgers-rodeo`. Avoid changing existing IDs unnecessarily: category IDs are used in links.
- Choose an existing meal section. If you add a new meal section, first save/publish it, then reopen the menu so the relation field can load that section from GitHub.
- Every uploaded photograph needs a short useful **Photo description** (alt text). The pre-save hook rejects photos without it. Use optimized JPG, PNG or WebP photographs under 5 MB; approximately 1600 px wide is plenty. The public renderer lazy-loads images.
- Press **Publish** (or Save/Publish as labeled in your installed Decap version). Simple publishing commits directly to `main`; it does not merely update the browser.
- Wait for the Cloudflare deployment to finish, then reload the public site. A failed build leaves the last successful production deployment live.

The public website fetches menu JSON on load and revalidates cached JSON. It does not automatically refresh the menu in tabs that were already open before a publication; reload those tabs. CMS edits and Git commits are not instant database writes to every visitor.

To undo an accidental update, revert its commit in GitHub or restore the old values in Decap and publish again. Coordinate edits if multiple owners are working on the menu at the same time: the whole menu is one JSON document, so do not overwrite a reported conflict.

## Local development

Node.js 22+ is needed for validation/tests; the public frontend has no npm dependencies.

```sh
npm run build
python3 -m http.server 8080 --directory public
```

Then open `http://localhost:8080` (not the HTML file directly). Fetching JSON requires a web server. Python's server is for local preview only and does not execute Pages Functions.

To exercise Pages Functions locally, install/use the official [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) and run `wrangler pages dev public` from the repository root. The production OAuth code intentionally rejects non-HTTPS and noncanonical origins. Use the production site for real CMS sign-in acceptance, or a separate HTTPS staging hostname and separate OAuth app, origin and secrets. Never disable the origin/state/PKCE checks just to make localhost login succeed.

Do not enable Decap `local_backend` on a public deployment. This package keeps it disabled.

## Menu JSON example

Actual content is already populated in `public/data/menu.json`. A shortened structural example:

```json
{
  "schema_version": 1,
  "meals": [{ "id": "breakfast", "name": "Breakfast" }],
  "categories": [{
    "id": "morning-favorites",
    "meal": "breakfast",
    "name": "Morning favorites",
    "description": "",
    "photo": "",
    "photo_alt": "",
    "available": true,
    "visible": true,
    "items": [{
      "id": "morning-big-breakfast",
      "name": "JC’s Big Breakfast",
      "price": "$10.29",
      "description": "Two eggs with your choice of potatoes, breakfast meat and toast.",
      "photo": "/uploads/big-breakfast.jpg",
      "photo_alt": "Eggs, toast and breakfast potatoes on a plate",
      "available": true,
      "visible": true
    }]
  }]
}
```

Array order is the display order. Prices are strings to preserve mixed sizes, add-ons and ranges. Availability and visibility are separate booleans. Blank optional fields can be omitted or null after a CMS edit; the model normalizes them. Structural problems fail the Cloudflare build and the CMS pre-save check. Local photo paths are also checked for file existence during the build.

## Security and maintenance

The `/admin/` HTML shell is public, while content writes are protected by GitHub OAuth and GitHub repository permissions. The login broker additionally checks the editor allowlist. It uses signed 10-minute Secure/HttpOnly/SameSite cookies, OAuth state, PKCE, a fixed callback origin and origin/source-checked popup messaging. Client secrets never reach the browser. OAuth responses are not cached, and credentials are not logged by the code.

Like the standard Decap GitHub backend, Decap receives the user's GitHub OAuth access token in the browser to call GitHub. Use trusted devices and log out after editing. Removing someone from the allowlist prevents new sign-ins; revoke repository access and revoke the OAuth authorization/token as well to terminate existing access. Review Cloudflare request logging if you enable it: callback query strings contain temporary OAuth codes and should not be retained unnecessarily.

The Decap browser bundle is pinned to version **3.17.3** on UNPKG. This is an external CMS dependency. Periodically review Decap releases, update the pinned version and test sign-in, editing, uploads and publication before production. No analytics or third-party tracking is included. The public hero image is served locally.

Do not add `Cross-Origin-Opener-Policy: same-origin` to `/admin/` or the OAuth callback: it would break the OAuth popup handshake. The admin uses `same-origin-allow-popups`; the callback explicitly preserves its opener. Public content uses a restrictive Content Security Policy; the admin permits only its CMS/CDN/API requirements. Cloudflare `_headers` applies to static assets, and Functions set their own headers in code.

No contact form is included; the preserved contact section uses tap-to-call. Weekly hours still need restaurant confirmation. Non-menu text, address, phone and hours are readable in `public/index.html`; the requested CMS manages menu content only.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Login says not configured | Production variables/secrets, exact `SITE_ORIGIN`, and redeployment |
| GitHub callback mismatch | OAuth App callback is exactly `SITE_ORIGIN/api/callback` |
| Login popup never completes | Popups allowed; canonical origin; no conflicting COOP header; cookies enabled |
| Login denied | Allowlist username, repo invitation accepted, Write permission, organization OAuth restrictions/SSO |
| Decap cannot load/write content | `backend.repo`, branch, OAuth scope and branch protection rules |
| New meal not in dropdown | Publish meal section first, then reopen the document |
| CMS save fails validation | Unique IDs, valid meal reference, required name, and alt text for every photo |
| Cloudflare build fails after photo upload | Photo path points to a committed file in `public/uploads`; review build output |
| Menu changes don't appear | Confirm CMS committed, Pages deployment succeeded, and reload public page |
| Admin says HTTPS required | Use the production HTTPS site; non-localhost HTTP previews cannot run Decap securely |
| Admin JS blocked | Preserve supplied admin CSP; verify UNPKG is reachable; pin upgrade tested version |
| Preview login rejected | Expected: CMS is restricted to the configured canonical production origin |

## Official references

- [Decap GitHub backend](https://decapcms.org/docs/github-backend/)
- [Decap backend configuration and OAuth proxy protocol](https://decapcms.org/docs/backends-overview/)
- [Decap list widget](https://decapcms.org/docs/widgets/list/)
- [Decap relation widget](https://decapcms.org/docs/widgets/relation/)
- [GitHub OAuth web flow, state and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages Functions secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets)
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Hero photograph source](https://images.unsplash.com/photo-1568901346375-23c9450c58cd) — replace with restaurant-owned photography before commercial launch if preferred.
