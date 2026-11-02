# Validation record

- `npm run build` passes: menu structure, unique IDs, references, local assets, HTML anchor targets, and 11 Node tests.
- Browser QA confirms all 104 migrated menu entries load from the separate JSON file.
- Browser QA confirms searching for `Rodeo` shows one matching dish.
- Browser QA confirms clicking the lunch/dinner anchor clears search and navigates to `#lunch-dinner`.
- Original typography, colors, hero image and overall page composition were retained; responsive CSS remains in place. A physical mobile device was not available for acceptance testing.
- Decap YAML parses successfully. The pinned Decap bundle loads in the browser, but this environment's HTTP preview is not a secure context and cannot initialize Decap's Web Crypto features. The admin now reports that HTTPS is required.
- OAuth tests mock GitHub: they cover signed cookies, PKCE, fixed origin, authorization-code exchange, allowlist checks, write permission checks, rejected editors and popup security.
- Real GitHub login, image upload, publishing and Cloudflare deployment require your configured repository, OAuth credentials and production HTTPS domain. They were not performed here. Follow the README's live acceptance check before handoff.

Menu prices and weekly opening hours still require confirmation from the restaurant.
