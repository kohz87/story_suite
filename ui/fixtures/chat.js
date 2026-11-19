// The chat view's fixture: two reply cards (an older one at rest and the newest), the newest's action line, the tab order and the ✦ sheets.
import { MOMENT } from './moment.js';

const ORDER = ['changes', 'chatter', 'here', 'choices'];
const CHATTER = [{ name: 'Torka', text: 'Two gold out of the box before noon. Rorke will ask.' }, { name: 'Brann', text: 'She has the letter. Good.' }];

/** The chat view-model for fixture `opts` (empty, fightOpen, rpg, notApplied), from the shared moment's here list and change lines. */
export function buildChat(opts, hereList, changes) {
  const scene = opts.fightOpen ? MOMENT.fightScene : MOMENT.scene;
  const notAppliedCount = changes.filter(c => !c.applied).length;
  const here = hereList.map(p => ({ personId: p.personId, name: p.name, portrait: p.portrait, meters: { ...p.meters } }));
  const lines = changes.map(c => ({ glyph: c.glyph, line: c.line, detail: c.detail, applied: c.applied, assist: false }));
  const pools = opts.rpg ? MOMENT.bars.map(b => ({ kind: b.kind, value: b.value, max: b.max, before: b.kind === 'hp' ? b.max : null })) : [];
  const older = {
    index: 1,
    top: { date: scene.date, time: '9:10 am', place: MOMENT.scene.place, weather: 'cold drizzle', pools: pools.map(p => ({ ...p, value: p.kind === 'hp' ? p.max : p.value, before: null })), condition: 'Split palms, river-damp' },
    changes: MOMENT.priorReplyMenu.lines.map(l => ({ ...l })),
    chatter: CHATTER.slice(0, 1),
    here: here.slice(0, 2),
    choices: [],
  };
  const newest = {
    index: 3,
    top: { date: scene.date, time: scene.time, place: opts.fightOpen ? scene.shortPlace : scene.place, weather: opts.fightOpen ? scene.weather : 'cold drizzle', pools, condition: MOMENT.you.condition },
    changes: lines,
    chatter: opts.empty ? [] : CHATTER.map(row => ({ ...row })),
    here,
    choices: opts.empty ? [] : [...(opts.fightOpen ? MOMENT.fightChoices : MOMENT.choices)],
  };
  const newestMenu = {
    at: `${scene.date}, ${scene.time}`,
    lines,
    repaired: false,
    counts: { changes: changes.length, heldBack: changes.filter(c => c.heldBack).length, notApplied: notAppliedCount },
    stateThen: { place: opts.fightOpen ? scene.shortPlace : scene.place, weather: opts.fightOpen ? scene.weather : 'cold drizzle' },
  };
  return {
    replies: opts.empty ? [] : [older, newest],
    head: {
      index: 3,
      actions: {
        fight: opts.fightOpen === true,
        loot: [],
        points: opts.rpg && !opts.empty ? { n: 1, who: ['Astra'] } : null,
        overdue: opts.empty ? null : { n: 1, names: ['Brann’s smith bill'] },
        joins: [],
        offers: 0,
        unrecorded: false,
      },
    },
    tabs: ORDER.map(id => ({ id, on: true })),
    replyMenu: structuredClone(newestMenu),
    // The ✦ sheets by reply (not a view key: the sheet tests' replies): 0 an older reply, 1 one with a repair to discard, 2 the newest.
    replyMenus: {
      0: structuredClone(MOMENT.priorReplyMenu),
      1: { at: 'Goldwane 13, 9:20 am', lines: [{ glyph: 'item', line: '+1 Rope', detail: null, applied: true, assist: true }, { glyph: 'coin', line: '−5', detail: null, applied: true, assist: true }], repaired: true, counts: { changes: 2, heldBack: 0, notApplied: 0 }, stateThen: { place: 'Guild Office, Bluewatch', weather: 'cold drizzle' } },
      2: structuredClone(newestMenu),
    },
  };
}
