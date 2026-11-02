import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateMenu, selectCategories, safePhoto } from '../public/assets/js/menu-model.js';
const menu = JSON.parse(await readFile(new URL('./fixtures/menu.json', import.meta.url)));

test('migration fixture remains a valid complete menu', () => {
  validateMenu(menu);
  assert.equal(menu.categories.length, 12);
  assert.equal(menu.categories.reduce((n, c) => n + c.items.length, 0), 104);
});
test('hidden items and categories are excluded; unavailable entries remain visible', () => {
  const data = structuredClone(menu);
  data.categories[0].visible = false;
  data.categories[1].items[0].visible = false;
  data.categories[1].items[1].available = false;
  const result = selectCategories(data);
  assert.ok(!result.some(c => c.id === data.categories[0].id));
  assert.ok(!result[0].items.some(i => i.id === data.categories[1].items[0].id));
  assert.equal(result[0].items[0].available, false);
});
test('search is case insensitive and preserves editorial order', () => {
  const result = selectCategories(menu, '  rOdEo ');
  assert.equal(result.length, 1);
  assert.equal(result[0].items[0].name, 'The Rodeo');
  assert.equal(selectCategories(menu, 'unlikely-dish-123').length, 0);
});
test('duplicate IDs, unknown meals and photos without alt text fail validation', () => {
  const data = structuredClone(menu);
  data.categories[0].items[0].id = data.categories[0].id;
  assert.throws(() => validateMenu(data), /unique/);
  data.categories[0].items[0].id = 'new-item';
  data.categories[0].meal = 'missing';
  assert.throws(() => validateMenu(data), /Unknown meal/);
  data.categories[0].meal = 'breakfast';
  data.categories[0].photo = '/uploads/food.jpg';
  assert.throws(() => validateMenu(data), /alt text/);
});
test('optional fields cleared by Decap normalize without mutating input', () => {
  const data = structuredClone(menu);
  delete data.categories[0].items[0].price;
  data.categories[0].items[0].photo = null;
  const normalized = validateMenu(data);
  assert.equal(normalized.categories[0].items[0].price, '');
  assert.equal(normalized.categories[0].items[0].photo, '');
  assert.equal(data.categories[0].items[0].price, undefined);
});
test('image URLs reject active content and unsafe URL variants', () => {
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,x', '//evil.test/x', '/\\evil.test/x', 'http://example.com/x']) assert.equal(safePhoto(value), '');
  assert.equal(safePhoto('/uploads/dish.jpg'), '/uploads/dish.jpg');
  assert.equal(safePhoto('https://example.com/dish.jpg'), 'https://example.com/dish.jpg');
});
