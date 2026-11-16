// Builds the Scene sheet (date, time, place, weather, who is here) as one hand correction, and opens it in a sheet.
import { h } from '../kit/dom.js';
import { button } from '../kit/controls.js';
import { openSheet } from '../kit/sheet.js';

const FIELDS = ['date', 'time', 'place', 'weather'];

/** The date line as the sheet shows it: "Goldwane 13, Fourthday". */
export function dateLine(scene = {}) {
  return [scene.date, scene.weekday].filter(Boolean).join(', ');
}

/** Returns only what changed: text fields as written, and `who: { add, remove }` for the people list. */
export function scenePatch(scene = {}, values = {}, here = []) {
  const patch = {};
  const was = { date: dateLine(scene), time: scene.time ?? '', place: scene.place ?? '', weather: scene.weather ?? '' };
  for (const key of FIELDS) {
    const next = (values[key] ?? '').trim();
    if (key in values && next !== was[key]) patch[key] = next;
  }
  if (Array.isArray(values.who)) {
    const add = values.who.filter(n => !here.includes(n));
    const remove = here.filter(n => !values.who.includes(n));
    if (add.length || remove.length) patch.who = { add, remove };
  }
  return patch;
}

function field(label, control) {
  return h('label', null, label, control);
}

/** Builds the form; `here` is the list of names; `onSave(patch)` and `onClose()` are called by its buttons. */
export function sceneSheet(scene = {}, here = [], { onSave, onClose } = {}) {
  const inputs = {
    date: h('input', { type: 'text', value: dateLine(scene) }),
    time: h('input', { type: 'text', value: scene.time ?? '' }),
    place: h('input', { type: 'text', value: scene.place ?? '' }),
    weather: h('input', { type: 'text', value: scene.weather ?? '' }),
  };
  let who = [...here];
  const list = h('span', { class: 'who' });
  const adder = h('input', { type: 'text', class: 'who-in', placeholder: 'Name', hidden: true, 'aria-label': 'Add a person' });
  const addBtn = h('button', { type: 'button', class: 'add' }, '+ Add');

  function draw() {
    list.replaceChildren(
      ...who.map(name => h('span', { dataset: { who: name } }, name,
        h('button', { type: 'button', 'aria-label': `Remove ${name}`, onClick: () => { who = who.filter(n => n !== name); draw(); } }, '×'))),
      adder,
      addBtn,
    );
  }
  function commitAdd() {
    const name = (adder.value ?? '').trim();
    adder.value = '';
    adder.setAttribute('hidden', '');
    if (name && !who.includes(name)) who.push(name);
    draw();
  }
  addBtn.addEventListener('click', () => {
    if (adder.hasAttribute('hidden')) { adder.removeAttribute('hidden'); adder.focus?.(); } else commitAdd();
  });
  adder.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault?.(); commitAdd(); } });
  draw();

  const collect = () => ({ ...Object.fromEntries(FIELDS.map(k => [k, inputs[k].value])), who });
  return h(
    'div',
    { class: 'scsheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Scene' },
    h('div', { class: 'sch' }, h('h3', null, 'Scene'), h('button', { type: 'button', class: 'x', 'aria-label': 'Close', onClick: () => onClose?.() }, '×')),
    h('div', { class: 'row2' }, field('Date', inputs.date), field('Time', inputs.time)),
    field('Place', inputs.place),
    field('Weather', inputs.weather),
    field('Who is here', list),
    h('p', { class: 'fine' }, 'A correction by hand applies from this reply on and shows in This reply as yours.'),
    h('div', { class: 'brow' }, h('span', { class: 'grow' }),
      button({ label: 'Cancel', className: 'cancel', onClick: () => onClose?.() }),
      button({ label: 'Save', tone: 'primary', className: 'save', onClick: () => onSave?.(scenePatch(scene, collect(), here)) })),
  );
}

/** Opens the Scene sheet; Save sends `scene.correct` with the changed fields (nothing when unchanged) through ctx.command or ctx.port. */
export function openSceneSheet(ctx = {}, scene = {}, here = []) {
  const send = ctx.command ?? (ctx.port ? ctx.port.command.bind(ctx.port) : () => {});
  const sheet = openSheet(ctx, { id: 'scene-sheet', label: 'Scene' });
  sheet.el.classList.add('sh-scene');
  sheet.body.appendChild(sceneSheet(scene, here, {
    onSave: async patch => {
      if (Object.keys(patch).length) await send('scene.correct', patch);
      sheet.close();
      ctx.refresh?.();
    },
    onClose: () => sheet.close(),
  }));
  sheet.body.querySelector('input')?.focus?.();
  return sheet;
}
