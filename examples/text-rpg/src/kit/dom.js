// Adapted from examples/text-rpg/src/kit/dom.js (keep in step when that file changes). Builds DOM elements from a tag, attributes and children, using text nodes only.

function isPlainAttrs(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && !('nodeType' in value);
}

function appendChild(parent, child, doc) {
  if (child === null || child === undefined || typeof child === 'boolean') return;
  if (Array.isArray(child)) {
    for (const item of child) appendChild(parent, item, doc);
    return;
  }
  if (typeof child === 'object' && 'nodeType' in child) {
    parent.appendChild(child);
    return;
  }
  parent.appendChild(doc.createTextNode(String(child)));
}

function applyClass(el, value) {
  el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
}

function applyStyle(el, value) {
  if (typeof value === 'string') {
    el.setAttribute('style', value);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [prop, val] of Object.entries(value)) {
      if (val !== null && val !== undefined) el.style.setProperty(prop, String(val));
    }
  }
}

function applyAttrs(el, attrs) {
  if (!attrs) return;
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'innerHTML' || key === 'outerHTML') {
      throw new TypeError(`${key} is not allowed in examples/text-rpg/src/kit/dom`);
    }
    if (val === null || val === undefined || val === false) continue;
    if (key === 'class' || key === 'className') {
      applyClass(el, val);
    } else if (key === 'style') {
      applyStyle(el, val);
    } else if (key === 'dataset' && typeof val === 'object') {
      for (const [dk, dv] of Object.entries(val)) {
        if (dv !== null && dv !== undefined && dv !== false) el.dataset[dk] = String(dv);
      }
    } else if (key.startsWith('on') && typeof val === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'value') {
      el.value = String(val);
      el.setAttribute('value', String(val));
    } else if (val === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key === 'htmlFor' ? 'for' : key, String(val));
    }
  }
}

function build(tag, args) {
  const doc = globalThis.document;
  const el = doc.createElement(tag);
  let start = 0;
  if (isPlainAttrs(args[0])) {
    applyAttrs(el, args[0]);
    start = 1;
  }
  for (let i = start; i < args.length; i += 1) {
    appendChild(el, args[i], doc);
  }
  return el;
}

/** Creates an HTML element from a tag, optional attributes object and children. */
export function h(tag, ...args) {
  return build(tag, args);
}
