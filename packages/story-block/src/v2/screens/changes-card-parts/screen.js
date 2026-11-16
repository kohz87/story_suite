// The `story-block/changes-card` screen: the inline card under a reply, its template and its styles.
import { STRINGS, html } from '../../strings.js';
import { BASE_CSS } from '../style.js';

export const CHANGES_CARD_SCREEN_ID = 'story-block/changes-card';

const C = STRINGS.card;

// `assisted` (MODULES §F123): the lines the Assist safety net applied on this reply ([{ line, late }],
// from its receipts), each shown with "(assist)" or "(assist, from the previous reply)".
// `refused` is not a state path: the host puts the reply's refused change lines in the card's scope
// (ui-host.js, from the turn's problems for that reply: [{ line, reason }]). A screen drawn without it
// (another host, a test) simply has none.
const TEMPLATE = `
<div class="chg">
  <ul class="tiles">
    <li class="tile line tone-good" data-each="state.inventory.stacks as s" data-if="changed(s)"
        data-class="eq: s.equipped != null">
      <span class="ico"><i class="fa-solid fa-box-open" aria-hidden="true"></i></span>
      <span class="tx"><span class="main" title="{{ state.inventory.defs[s.def].name }}">{{ state.inventory.defs[s.def].name }}</span>
        <span class="sub">${html(C.itemNow, { qty: '{{ s.qty }}' })}</span>
        <span class="sub" data-if="s.equipped" title="${html(C.equipped, { slot: '{{ s.equipped }}' })}">${html(C.equipped, { slot: '{{ s.equipped }}' })}</span></span>
    </li>
    <li class="tile line coin tone-warn" data-if="changed('state.inventory.wallets.party')">
      <span class="ico"><i class="fa-solid fa-coins" aria-hidden="true"></i></span>
      <span class="tx">
      <span class="main" data-if="len(q.currency.coins) == 0">${html(C.wallet, { coin: '<b>{{ state.inventory.wallets.party.coin }}</b>', money: '<span data-if="state.inventory.wallets.party.coin == 1">{{ q.currency.name }}</span><span data-if="state.inventory.wallets.party.coin != 1">{{ q.currency.plural }}</span>' })}</span>
      <span class="main" data-if="len(q.currency.coins) > 0" title="{{ fmt.money(state.inventory.wallets.party.coin) }}">${html(C.wallet, { coin: '<b>{{ fmt.money(state.inventory.wallets.party.coin) }}</b>', money: '' })}</span></span>
    </li>
    <li class="tile line place tone-info" data-if="changed('state.scene.place')">
      <span class="ico"><i class="fa-solid fa-location-dot" aria-hidden="true"></i></span>
      <span class="tx" data-if="state.scene.place.name"><span class="main">${html(C.movedTo)}</span> <span class="sub" title="{{ state.scene.place.name }}">{{ state.scene.place.name }}</span></span>
      <span class="tx" data-if="!state.scene.place.name"><span class="main">${html(C.placeCleared)}</span></span>
    </li>
    <li class="tile line present tone-accent" data-if="changed('state.scene.present')">
      <span class="ico"><i class="fa-solid fa-users" aria-hidden="true"></i></span>
      <span class="tx" data-if="len(state.scene.present) > 0"><span class="main" title="{{ state.scene.present }}">{{ state.scene.present }}</span> <span class="sub">${html(C.hereLabel)}</span></span>
      <span class="tx" data-if="len(state.scene.present) == 0"><span class="main">${html(C.nobodyNow)}</span></span>
    </li>
    <li class="tile line extra" data-each="moduleLines as x" data-if="x.kind != 'check'" data-class="tone-good: x.tone == 'good'; tone-bad: x.tone == 'bad'; tone-warn: x.tone == 'warn'; tone-info: x.tone == 'info'; tone-accent: x.tone == 'accent'">
      <span class="ico"><i class="fa-solid {{ x.icon }}" aria-hidden="true"></i></span>
      <span class="tx"><span class="main" title="{{ x.text }}">{{ x.text }}</span> <span class="sub flag" data-if="x.flag != ''" title="{{ x.flag }}">{{ x.flag }}</span> <span class="sub note" data-if="x.note != ''" title="{{ x.note }}">{{ x.note }}</span></span>
    </li>
  </ul>
  <ul class="edits" data-if="len(edits) > 0">
    <li class="edit line" data-each="edits as e"><i class="fa-solid fa-pencil" aria-hidden="true"></i> <span>{{ e.text }}</span></li>
  </ul>
  <p class="edit-hint muted" data-if="editableHead == true && len(edits) > 0">${html(C.editHint)}</p>
  <ul class="checks">
    <li class="check" data-each="moduleLines as x" data-if="x.kind == 'check'" data-class="good: x.check.result == 'success'; bad: x.check.result == 'fail'">
      <span class="dice">{{ x.check.d20 }}</span>
      <span class="what"><b data-if="x.check.label != ''">{{ x.check.label }}</b><span data-if="x.check.label != ''">${html(C.labelJoin)}</span>${html(C.checkLine, { d20: '{{ x.check.d20 }}', roll: '{{ x.check.rollText }}', mod: '{{ x.check.modText }}', total: '{{ x.check.total }}', dc: '{{ x.check.dc }}', word: '<b class="res">{{ x.check.word }}</b>' })}</span>
      <span class="story" data-if="x.check.disagree != ''">{{ x.check.disagree }}</span>
    </li>
  </ul>
  <div class="loot" data-each="state.inventory.loot as o, sid" data-if="changed(o)">
    <p class="loot-head"><i class="fa-solid fa-sack-dollar" aria-hidden="true"></i> <b>${html(C.loot)}</b><span class="where" data-if="o.where"> — {{ o.where }}</span></p>
    <div class="offer" data-if="state.meta.claims[o.claim] != true">
      <div class="chips">
        <label class="chip pick" data-each="o.items as it, i"><input type="checkbox" data-draft="pick" value="{{ i }}"> <span>{{ it.name }}</span><span class="n" data-if="it.qty != 1"> ×{{ it.qty }}</span></label>
      </div>
      <p class="hint muted">${html(C.lootPick)}</p>
      <button class="btn take" data-command="inventory.lootTake" data-payload='{"sid":"{{ sid }}","pick":{{ draft.pick }}}'
              title="${html(C.lootTakeTitle)}"><i class="fa-solid fa-hand" aria-hidden="true"></i> ${html(C.lootTake)}</button>
    </div>
    <p class="taken muted" data-if="state.meta.claims[o.claim] == true">${html(C.lootTaken)}</p>
  </div>
  <p class="none muted" data-if="!changed('state.inventory') && !changed('state.scene') && len(moduleLines) == 0 && len(edits) == 0">${html(C.nothing)}</p>
  <ul class="refused" data-if="len(refused) > 0">
    <li class="line" data-each="refused as r">
      <i class="fa-solid fa-ban" aria-hidden="true"></i>
      <span><span class="label">${html(C.notApplied)}</span> <span class="raw">{{ r.line }}</span><span class="why" data-if="r.reason"> — {{ r.reason }}</span></span>
    </li>
  </ul>
  <ul class="warned" data-if="len(warned) > 0">
    <li class="line" data-each="warned as w">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <span><span class="label">${html(C.appliedCheck)}</span> <span class="raw">{{ w.line }}</span><span class="why" data-if="w.reason"> — {{ w.reason }}</span></span>
    </li>
  </ul><ul class="module-failed" data-if="len(moduleFailed) > 0">
    <li class="line" data-each="moduleFailed as m">
      <i class="fa-solid fa-plug-circle-xmark" aria-hidden="true"></i>
      <span>${html(C.moduleFailed, { name: '<span class="label">{{ m.name }}</span>', reason: '<span class="why">{{ m.reason }}</span>' })}</span>
    </li>
  </ul>
  <ul class="assisted" data-if="len(assisted) > 0" title="${html(C.assistTitle)}">
    <li class="line" data-each="assisted as a">
      <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
      <span><span class="raw">{{ a.line }}</span> <span class="muted" data-if="!a.late">${html(C.assist)}</span><span class="muted" data-if="a.late">${html(C.assistLate)}</span></span>
    </li>
  </ul>
</div>`;

const CSS = `${BASE_CSS}
/* Reply.dc.html's card: the changes as a grid of tiles (34px icon tile, a bold line, a muted line, a 1.5px ring by kind), the
   checks as full-width rows under it, and the assist and other lines last, small and muted. The grid's columns follow the card's
   own width (a container query): 2 below 560px (a phone, 360 to 412), 3 between, 4 from 900px. Colours are the theme's tokens. */
.chg { display: grid; gap: 10px; font-size: 0.95em; container-type: inline-size; min-width: 0; }
.tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@container (min-width: 560px) { .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container (min-width: 900px) { .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.tile { --ring: var(--ss-border); display: flex; align-items: center; gap: 8px; min-width: 0; padding: 10px; border-radius: var(--ss-radius-m, 14px);
        background: var(--ss-glass, var(--ss-tile)); border: 1.5px solid var(--ring); }
.tile .ico { flex: none; width: 34px; height: 34px; border-radius: var(--ss-radius-s, 10px); background: var(--ss-tile); color: var(--ring);
             display: flex; align-items: center; justify-content: center; }
.tile .tx { min-width: 0; display: grid; gap: 1px; }
/* A long line wraps to two lines and is cut after that; the full text is the span's title. */
.tile .main, .tile .sub { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
.tile .main { font-weight: 700; }
.tile .sub { font-size: 0.9em; color: var(--ss-muted); }
.tile.tone-good { --ring: var(--ss-good); }
.tile.tone-bad { --ring: var(--ss-bad); }
.tile.tone-warn { --ring: var(--ss-warn); }
.tile.tone-info { --ring: var(--ss-info); }
.tile.tone-accent { --ring: var(--ss-accent); }
.edits { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.edit { display: flex; gap: 8px; align-items: center; padding: 10px; border: 1px solid var(--ss-accent); border-radius: var(--ss-radius-m); overflow-wrap: anywhere; }
.edit i { color: var(--ss-accent-text); }
.edit-hint { margin: 0; font-size: 0.85em; }
/* The checks: a 34px tile with the d20, the line beside it (wraps under the tile's edge, never over it). The ring is the row's border and
   tint; the words are the theme's text colour (the tone colours are under 4.5:1 on the light glass). */
.checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.check { --ring: var(--ss-border); display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 4px 10px; align-items: center; padding: 8px 12px;
         border-radius: 12px; border: 1px solid var(--ring); background: color-mix(in srgb, var(--ring) 10%, transparent); color: var(--ss-text, var(--sb-fg)); }
.check.good { --ring: var(--ss-good); }
.check.bad { --ring: var(--ss-bad); }
.check .dice { width: 34px; height: 34px; border-radius: 9px; background: var(--ss-tile); display: flex; align-items: center; justify-content: center;
               font-weight: 800; font-size: 1.15em; color: var(--ss-text); }
.check .what { min-width: 0; overflow-wrap: anywhere; line-height: 1.35; }
.check .res { font-weight: 800; }
.check .story { grid-column: 2; justify-self: end; font-size: 0.85em; text-align: right; }
.none { margin: 0; }
.loot { margin-top: 2px; padding-top: 10px; border-top: 1px solid var(--ss-border, var(--sb-border)); display: grid; gap: 6px; }
.loot-head { margin: 0; }
.loot .chips { display: flex; flex-wrap: wrap; gap: 4px; }
.loot .pick { display: inline-flex; gap: 4px; align-items: center; cursor: pointer; padding: 1px 8px; border-radius: 999px;
              border: 1px solid var(--sb-border); background: var(--sb-surface); }
.loot .pick:has(input:checked) { border-color: var(--sb-accent); color: var(--sb-accent); }
.loot .pick input { width: 1em; height: 1em; min-width: 0; margin: 0; accent-color: var(--sb-accent); }
.loot .hint, .loot .taken { margin: 0; font-size: 0.9em; }
.loot .take { justify-self: start; }
/* The lines last: muted and small (the refused and the assist lines). */
.refused, .warned, .module-failed, .assisted { display: grid; gap: 4px; margin: 0; padding: 8px 0 0; border-top: 1px solid var(--ss-border, var(--sb-border)); list-style: none;
                      color: var(--ss-muted, var(--sb-em)); font-size: 0.85em; }
.refused .line, .warned .line, .module-failed .line, .assisted .line { display: flex; gap: 8px; align-items: flex-start; }
.refused .line > i, .warned .line > i, .module-failed .line > i, .assisted .line > i { flex: none; width: 16px; text-align: center; padding-top: 2px; }
.refused .line > span, .warned .line > span, .module-failed .line > span, .assisted .line > span { flex: 1 1 0; min-width: 0; overflow-wrap: anywhere; }
.refused .line > i, .module-failed .line > i { color: var(--ss-bad-text, var(--ss-bad, var(--sb-em))); }
.warned .line > i { color: var(--ss-warn-text, var(--ss-warn, inherit)); }
.assisted .raw, .refused .raw, .warned .raw { font-family: var(--monoFontFamily, monospace); font-size: 0.95em; overflow-wrap: anywhere; }
`;

export const changesCardScreen = Object.freeze({
    id: CHANGES_CARD_SCREEN_ID,
    title: C.title,
    icon: 'fa-list-check',
    mounts: Object.freeze(['card']),
    // Shown under every reply until the reader turns it off (MODULES §F24).
    defaultOn: true,
    data: Object.freeze({ currency: Object.freeze({ query: 'inventory.currency' }) }),
    template: TEMPLATE,
    css: CSS,
});
