// Builds plain-JSON story-state view-model fixtures and variants (default, rpgOff, fightOpen, empty).

import { MOMENT } from './moment.js';
import { PEOPLE } from './people.js';
import { partyFixture } from './party.js';
import { bagFixture } from './bag.js';
import { fightSceneAnswer, fightHoldScene } from './fight-scene.js';
import { selectScene } from '../select/interaction.js';
import { worldFor } from './world.js';
import { buildJournal } from './journal.js';
import { buildStory } from './story.js';
import { buildSettings } from './settings.js';
import { DOSSIERS, dossierFor } from './dossier.js';
import { sceneFixture } from './interaction.js';

function resolveOptions(variant) {
  if (typeof variant === 'string') {
    const key = variant.toLowerCase();
    return {
      rpg: key !== 'rpgoff' && key !== 'rpg-off' && key !== 'story-only',
      fightOpen: key === 'fightopen' || key === 'fight-open',
      empty: key === 'empty',
      notApplied: false,
      focus: 'boat',
      planShown: false,
      fightState: 'choose',
      bagLoad: 0,
      scene: null,
    };
  }
  const opts = variant && typeof variant === 'object' ? variant : {};
  return {
    rpg: opts.rpg !== false,
    fightOpen: Boolean(opts.fightOpen),
    empty: Boolean(opts.empty),
    notApplied: Boolean(opts.notApplied),
    focus: opts.focus || 'boat',
    planShown: Boolean(opts.planShown),
    fightState: opts.fightState || 'choose',
    bagLoad: Number(opts.bagLoad) || 0,
    scene: opts.scene || null,
    sceneLong: Boolean(opts.sceneLong),
    sceneFight: Boolean(opts.sceneFight),
  };
}

function buildScene(opts) {
  const src = opts.fightOpen ? MOMENT.fightScene : MOMENT.scene;
  return {
    date: src.date,
    weekday: src.weekday,
    time: src.time,
    place: src.place,
    region: src.region,
    weather: src.weather,
  };
}

function buildCard(opts) {
  const scene = buildScene(opts);
  return {
    rpg: opts.rpg,
    scene,
    you: {
      portrait: MOMENT.you.portrait,
      name: MOMENT.you.name,
      levelText: opts.rpg ? MOMENT.you.levelText : null,
      className: opts.rpg ? MOMENT.you.className : null,
    },
    chips: {
      soakPct: opts.rpg ? MOMENT.chips.soakPct : null,
      party: opts.rpg ? { ...MOMENT.chips.party } : null,
      pace: { ...MOMENT.chips.pace },
    },
    bars: opts.rpg ? MOMENT.bars.map(b => ({ ...b })) : [],
    exp: opts.rpg ? { ...MOMENT.exp } : null,
    // Story-only keeps its status chips (decision 23) but has no stance to report.
    statuses: MOMENT.statuses.filter(s => opts.rpg || !RPG_ONLY_STATUS.has(s.id)).map(s => ({ ...s })),
  };
}

// Statuses that exist only with RPG on: stances (the mock hides them as .rpgonly).
const RPG_ONLY_STATUS = new Set(['shadow-step']);

function buildHereList(opts) {
  if (opts.empty) return [];
  if (opts.fightOpen) {
    return PEOPLE.cast
      .filter(p => p.inParty)
      .map(p => {
        const over = PEOPLE.fightOverrides[p.personId] || {};
        return {
          ...p,
          meters: { ...(over.meters ?? p.meters) },
          scene: p.scene ? { ...p.scene } : null,
          mood: over.mood ?? p.mood,
          where: over.where ?? p.where,
          thought: over.thought ?? p.thought,
        };
      });
  }
  return PEOPLE.cast
    .filter(p => p.at === 'here')
    .map(p => ({ ...p, meters: { ...p.meters }, scene: p.scene ? { ...p.scene } : null }));
}

function buildChanges(opts) {
  if (opts.empty) return [];
  return MOMENT.changes.map((c, idx) => {
    const line = opts.fightOpen && c.fightLine ? c.fightLine : c.line;
    let detail = opts.fightOpen && c.fightDetail ? c.fightDetail : c.detail;
    if (!opts.rpg && c.storyDetail) detail = c.storyDetail;
    const applied = opts.notApplied && idx === 3 ? false : c.applied;
    return {
      glyph: c.glyph,
      line,
      detail,
      applied,
      heldBack: c.heldBack ? { ...c.heldBack } : null,
    };
  });
}

function buildNeedsYou(opts) {
  if (opts.empty) return [];
  const items = [];
  if (opts.fightOpen) items.push({ ...MOMENT.needs.fight });
  items.push({ ...MOMENT.needs.overdue });
  if (opts.rpg) items.push({ ...MOMENT.needs.points });
  return items;
}

function buildNow(opts, hereList, changes, needsYou) {
  if (opts.empty) {
    return {
      needsYou: [],
      today: { focus: null, trip: null, dueSoon: null, torn: [] },
      here: [],
      thisTurn: { count: 0, items: [] },
      you: { look: MOMENT.you.look, position: MOMENT.you.position, condition: MOMENT.you.condition },
      pinned: [],
    };
  }
  const focus = MOMENT.focuses[opts.focus] || MOMENT.focuses.boat;
  return {
    needsYou,
    today: {
      focus: { ...focus, go: 'journal' },
      trip: { ...(opts.fightOpen ? MOMENT.fightTrip : MOMENT.trip), go: 'world' },
      dueSoon: { ...MOMENT.dueSoon },
      torn: opts.rpg ? MOMENT.torn.map(t => ({ ...t })) : [],
    },
    here: hereList,
    thisTurn: { count: changes.length, items: changes },
    you: {
      look: MOMENT.you.look,
      position: opts.fightOpen ? MOMENT.you.fightPosition : MOMENT.you.position,
      condition: MOMENT.you.condition,
    },
    pinned: MOMENT.pinned.map(tr => ({
      trackerId: tr.trackerId,
      name: tr.name,
      fields: tr.fields.map(f => ({ ...f })),
    })),
  };
}

function buildChat(opts, hereList, changes, needsYou) {
  const scene = opts.fightOpen ? MOMENT.fightScene : MOMENT.scene;
  const notAppliedCount = changes.filter(c => !c.applied).length;
  const needParts = ['Brann’s overdue smith bill'];
  if (opts.rpg) needParts.push('1 point to spend');
  if (opts.fightOpen) needParts.push('the open fight');

  return {
    inlineRow: {
      date: scene.date,
      time: scene.time,
      place: opts.fightOpen ? scene.shortPlace : scene.place,
      weather: opts.fightOpen ? scene.weather : 'cold drizzle',
      money: { short: MOMENT.money.short, words: MOMENT.money.words },
      changes: changes.length,
      notApplied: notAppliedCount,
      needsYou: {
        n: needsYou.length,
        title: needsYou.length ? `Needs your action: ${needParts.join(' · ')}` : '',
      },
      fightOpen: opts.fightOpen,
      choices: opts.empty ? [] : [...(opts.fightOpen ? MOMENT.fightChoices : MOMENT.choices)],
    },
    drawer: hereList.map(p => ({
      personId: p.personId,
      name: p.name,
      portrait: p.portrait,
      meters: { ...p.meters },
      mood: p.mood,
      where: p.where.slice(0, 40),
      thought: p.thought,
    })),
    replyMenus: {
      0: structuredClone(MOMENT.priorReplyMenu),
      2: {
        at: `${scene.date}, ${scene.time}`,
        lines: changes.map(c => ({ glyph: c.glyph, line: c.line, detail: c.detail, applied: c.applied })),
        counts: {
          changes: changes.length,
          heldBack: changes.filter(c => c.heldBack).length,
          notApplied: notAppliedCount,
        },
        stateThen: { place: opts.fightOpen ? scene.shortPlace : scene.place, weather: opts.fightOpen ? scene.weather : 'cold drizzle' },
      },
    },
  };
}

function buildPeople(opts, hereList) {
  if (opts.empty) {
    return {
      filter: 'all',
      counts: { all: 0, party: 0, followed: 0, deceased: 0, notSeenLately: 0 },
      here: [],
      elsewhere: [],
      notSeenLately: 0,
      deceased: [],
    };
  }
  const hereIds = new Set(hereList.map(p => p.personId));
  const elsewhere = PEOPLE.cast
    .filter(p => p.at === 'away' && !hereIds.has(p.personId))
    .map(p => ({ ...p, meters: { ...p.meters } }));
  const deceased = PEOPLE.cast
    .filter(p => p.at === 'dead')
    .map(p => ({ ...p, meters: { ...p.meters }, death: { ...p.death } }));
  const dormant = PEOPLE.cast.filter(p => p.at === 'dormant');
  const active = [...hereList, ...elsewhere];
  return {
    filter: 'all',
    counts: {
      all: active.length,
      party: active.filter(p => p.inParty).length,
      followed: active.filter(p => p.followed).length,
      deceased: deceased.length,
      notSeenLately: dormant.length,
    },
    here: hereList,
    elsewhere,
    notSeenLately: dormant.length,
    deceased,
  };
}

export function fixture(variant = 'default') {
  const opts = resolveOptions(variant);
  const hereList = buildHereList(opts);
  const changes = buildChanges(opts);
  const needsYou = buildNeedsYou(opts);

  return {
    // The open interaction (the activity tab): present only when asked for, so every other fixture is as it was.
    ...(opts.scene && !opts.sceneFight ? { scene: sceneFixture(opts.scene, { long: opts.sceneLong }) } : {}),
    card: buildCard(opts),
    now: buildNow(opts, hereList, changes, needsYou),
    chat: buildChat(opts, hereList, changes, needsYou),
    people: buildPeople(opts, hereList),
    party: opts.rpg ? partyFixture() : null,
    bag: bagFixture({ rpg: opts.rpg, load: opts.bagLoad }),
    // the open fight, as the activity host gets it (the Fight tab); its offer moment is the waiting fight (the pause before the message goes out)
    fight: opts.fightOpen && opts.fightState === 'offer' && !opts.sceneFight ? fightHoldScene()
      : opts.fightOpen || (opts.scene && opts.sceneFight) ? selectScene(fightSceneAnswer(opts.fightState, { scene: opts.sceneFight ? opts.scene : null })) : null,
    world: worldFor(opts.empty ? 'empty' : opts.fightOpen ? 'fightOpen' : 'default'),
    journal: buildJournal({ rpg: opts.rpg, empty: opts.empty }),
    story: buildStory({ empty: opts.empty, planShown: opts.planShown }),
    settings: buildSettings({ rpg: opts.rpg }),
    // (no join card with the RPG off: rpg.partyAdd is not answered then)
    dossier: Object.fromEntries(Object.keys(DOSSIERS).map(id => [id, opts.rpg ? dossierFor(id) : { ...dossierFor(id), partyAdd: null }])),
  };
}
