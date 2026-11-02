import { validateMenu, safePhoto, selectCategories } from './menu-model.js';

document.documentElement.classList.remove('no-js');
const content = document.querySelector('#menu-content');
const status = document.querySelector('#menu-status');
const search = document.querySelector('#search');
const mealLinks = document.querySelector('.tabs');
const categoryLinks = document.createElement('div');
categoryLinks.className = 'categories';
categoryLinks.setAttribute('aria-label', 'Menu categories');
document.querySelector('.controls').append(categoryLinks);
let menu;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function photo(entry, className) {
  const src = safePhoto(entry.photo);
  if (!src) return null;
  const image = element('img', '', className);
  image.src = src;
  image.alt = entry.photo_alt;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.width = className === 'category-photo' ? 400 : 180;
  image.height = 120;
  image.addEventListener('error', () => image.remove(), { once: true });
  return image;
}

function render() {
  const categories = selectCategories(menu, search.value);
  const fragment = document.createDocumentFragment();
  const links = document.createDocumentFragment();
  let count = 0;
  for (const meal of menu.meals) {
    const groups = categories.filter(category => category.meal === meal.id);
    const section = element('section', '', 'meal');
    section.id = meal.id;
    section.append(element('h3', meal.name, 'meal-title'));
    if (!groups.length) section.append(element('p', search.value ? 'No matches in this menu.' : 'Menu coming soon.'));
    for (const category of groups) {
      const group = element('section', '', 'group');
      group.id = `category-${category.id}`;
      const link = element('a', category.name);
      link.href = `#${group.id}`;
      links.append(link);
      group.append(element('h4', category.name));
      const categoryPhoto = photo(category, 'category-photo');
      if (categoryPhoto) group.append(categoryPhoto);
      if (category.description) group.append(element('p', category.description));
      if (!category.available) group.append(element('p', 'Currently unavailable', 'availability'));
      const items = element('div', '', 'items');
      for (const item of category.items) {
        const available = category.available && item.available;
        const article = element('article', '', `item${available ? '' : ' unavailable'}`);
        const image = photo(item, 'menu-photo');
        if (image) article.append(image);
        const heading = element('div', '', 'item-head');
        heading.append(element('strong', item.name), element('span', item.price, 'price'));
        article.append(heading);
        if (item.description) article.append(element('p', item.description));
        if (!available) article.append(element('span', 'Currently unavailable', 'availability'));
        items.append(article);
        count++;
      }
      group.append(items);
      section.append(group);
    }
    fragment.append(section);
  }
  content.replaceChildren(fragment);
  categoryLinks.replaceChildren(links);
  status.textContent = search.value ? `${count} menu ${count === 1 ? 'item' : 'items'} found.` : '';
}

async function loadMenu() {
  try {
    const response = await fetch('/data/menu.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Menu request failed.');
    menu = validateMenu(await response.json());
    mealLinks.replaceChildren(...menu.meals.map(meal => {
      const link = element('a', meal.name);
      link.href = `#${meal.id}`;
      return link;
    }));
    search.disabled = false;
    render();
    // Anchor navigation also works when a search had filtered out a category.
    mealLinks.addEventListener('click', () => {
      if (search.value) { search.value = ''; render(); }
    });
    // Support direct links such as /#category-burgers after the async load.
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  } catch {
    content.replaceChildren(element('p', 'We couldn’t load the menu. Please call 440-834-1900 for menu information.'));
    status.textContent = '';
    const retry = element('button', 'Try again', 'button');
    retry.type = 'button';
    retry.addEventListener('click', () => { content.textContent = 'Loading the menu…'; loadMenu(); }, { once: true });
    content.append(retry);
  } finally {
    content.setAttribute('aria-busy', 'false');
  }
}
search.addEventListener('input', () => { if (menu) render(); });
loadMenu();
