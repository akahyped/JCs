import { readFile, stat } from 'node:fs/promises';
import { validateMenu, safePhoto } from '../public/assets/js/menu-model.js';

const root = new URL('../', import.meta.url);
const data = validateMenu(JSON.parse(await readFile(new URL('public/data/menu.json', root), 'utf8')));
const html = await readFile(new URL('public/index.html', root), 'utf8');
if (html.includes('article class="item"')) throw new Error('Menu items must not be hardcoded into HTML.');
for (const path of ['public/assets/css/styles.css', 'public/assets/js/menu.js', 'public/admin/config.yml', 'functions/api/auth.js', 'functions/api/callback.js']) await stat(new URL(path, root));
for (const category of data.categories) {
  for (const entry of [category, ...category.items]) {
    const photo = safePhoto(entry.photo);
    if (photo.startsWith('/')) {
      if (photo.includes('..') || photo.includes('?') || photo.includes('#') || /%2e|%2f/i.test(photo)) throw new Error('Use a simple local photo path.');
      await stat(new URL(`public${photo}`, root));
    }
  }
}
for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const value = match[1];
  if (value.startsWith('#')) {
    const id = value.slice(1);
    if (!html.includes(`id="${id}"`) && !data.meals.some(meal => meal.id === id)) throw new Error(`Missing anchor ${value}`);
  } else if (value.startsWith('/')) {
    // URL query strings version assets; they are not part of filesystem names.
    const pathname = new URL(value, 'https://jcs.example').pathname;
    await stat(new URL(`public${pathname}`, root));
  }
}
console.log(`Validated ${data.categories.length} categories and ${data.categories.reduce((n, c) => n + c.items.length, 0)} menu entries.`);

