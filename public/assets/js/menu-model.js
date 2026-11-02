/** Shared menu rules. Text is rendered with textContent, never interpreted as HTML. */
export function validateMenu(data) {
  if (data?.schema_version !== 1 || !Array.isArray(data.meals) || !Array.isArray(data.categories)) {
    throw new Error('Unsupported menu format.');
  }
  data = structuredClone(data);
  // Decap can omit optional fields after an editor clears them.
  for (const category of data.categories) {
    category.description ??= '';
    category.photo ??= '';
    category.photo_alt ??= '';
    category.items ??= [];
    if (!Array.isArray(category.items)) throw new Error('Category items must be a list.');
    for (const item of category.items) {
      item.description ??= '';
      item.price ??= '';
      item.photo ??= '';
      item.photo_alt ??= '';
    }
  }
  const ids = new Set();
  function id(value) {
    if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || ids.has(value)) {
      throw new Error(`Menu IDs must be unique lowercase slugs: ${value}`);
    }
    ids.add(value);
  }
  function text(value, field, required = false) {
    if (typeof value !== 'string' || (required && !value.trim())) throw new Error(`Invalid ${field}.`);
  }
  const meals = new Set();
  for (const meal of data.meals) {
    id(meal.id);
    text(meal.name, 'meal name', true);
    if (['home', 'menu', 'visit', 'contact', 'search', 'menu-content', 'menu-status'].includes(meal.id) || meal.id.startsWith('category-')) throw new Error('Meal ID conflicts with a page anchor.');
    meals.add(meal.id);
  }
  for (const category of data.categories) {
    id(category.id);
    if (!meals.has(category.meal)) throw new Error('Unknown meal.');
    text(category.name, 'category name', true);
    text(category.description, 'category description');
    for (const entry of [category, ...(category.items || [])]) {
      if (entry !== category) {
        id(entry.id);
        text(entry.name, 'item name', true);
        text(entry.description, 'item description');
        text(entry.price, 'price');
      }
      if (typeof entry.available !== 'boolean' || typeof entry.visible !== 'boolean') throw new Error('Invalid visibility or availability.');
      text(entry.photo, 'photo');
      text(entry.photo_alt, 'photo alt');
      if (entry.photo && (!safePhoto(entry.photo) || !entry.photo_alt.trim())) throw new Error('Photo needs a valid URL and alt text.');
    }
    if (!Array.isArray(category.items)) throw new Error('Category items must be a list.');
  }
  return data;
}

/** Same-site uploads and HTTPS photos only. Reject scripts, SVG data URLs and protocol-relative URLs. */
export function safePhoto(value) {
  if (!value || typeof value !== 'string' || /[\\\s\u0000-\u001f]/.test(value)) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function selectCategories(data, query = '') {
  const q = query.trim().toLocaleLowerCase();
  return data.categories.filter(category => category.visible).map(category => ({
    ...category,
    items: category.items.filter(item => item.visible && (!q ||
      `${category.name} ${item.name} ${item.description}`.toLocaleLowerCase().includes(q))),
  })).filter(category => !q || category.items.length > 0 ||
    (category.items.length === 0 && `${category.name} ${category.description}`.toLocaleLowerCase().includes(q)));
}
