import { validateMenu } from '/assets/js/menu-model.js';

// Module scripts and deferred classic scripts have separate fetch timing.
// Wait briefly for the pinned Decap bundle rather than relying on execution order.
let attempts = 0;
function start() {
  if (!window.isSecureContext) {
    document.body.textContent = 'The menu editor requires HTTPS. Open /admin/ on your configured production website.';
    return;
  }
  if (!window.CMS) {
    if (++attempts < 300) { setTimeout(start, 100); return; }
    document.body.textContent = 'The menu editor could not load. Check your connection and reload this page.';
    return;
  }
  window.CMS.registerEventListener({
    name: 'preSave',
    handler: ({ entry }) => {
      validateMenu(entry.get('data').toJS());
    },
  });
  window.CMS.init();
}
start();
