// The Grid view's own CSS (tiles, folds, the List | Grid switch).

/** The Grid view's CSS, added after the screen's own CSS (BASE_CSS first). Tiles are square, four to a line on a phone. (The sheet's CSS is in view/mounts-*.css: it is outside the screen.) */
export const GRID_CSS = `
.tile-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; list-style: none; margin: 0; padding: 0; }
@container (min-width: 520px) { .tile-grid { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); } }
.tile-cell { min-width: 0; }
.tile { position: relative; display: flex; flex-direction: column; justify-content: flex-end; width: 100%; aspect-ratio: 1 / 1; min-width: 0; min-height: 36px;
  overflow: hidden; padding: 6px; border: 1.5px solid var(--rarity, var(--sb-common)); border-radius: 12px; background: var(--sb-surface);
  color: var(--sb-fg); font: inherit; text-align: left; cursor: pointer; }
.tile.r-uncommon { --rarity: var(--sb-uncommon); }
.tile.r-rare { --rarity: var(--sb-rare); }
.tile.r-epic { --rarity: var(--sb-epic); }
.tile.r-legendary { --rarity: var(--sb-legendary); }
.tile:focus-visible, .fold-head:focus-visible { outline: 2px solid var(--sb-accent); outline-offset: 2px; }
.tile .nm { font-size: 11px; font-weight: 700; line-height: 1.15; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.tile .bn { margin-top: 2px; font-size: 10px; font-weight: 800; color: var(--ss-good, var(--sb-good)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile .sl { position: absolute; top: 5px; left: 6px; font-size: 8.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--sb-em); }
.tile .q { position: absolute; top: 4px; right: 6px; font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; }
.tile .dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--ss-warn, #e0b04a); }
.tile .dot.cond-broken { background: var(--ss-bad, var(--sb-bad)); }
.tile .lock { position: absolute; right: 5px; bottom: 5px; font-size: 9px; color: var(--sb-em); }
.fold-sec { display: grid; gap: 8px; }
.fold-head { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 6px 10px; border: 1px solid var(--sb-border); border-radius: 12px;
  background: transparent; color: var(--sb-fg); font: inherit; text-align: left; cursor: pointer; min-width: 0; }
.fold-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.fold-count { margin-left: auto; color: var(--sb-em); font-variant-numeric: tabular-nums; }
.fold-chev { flex: none; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; }
.fold-chev svg { width: 12px; height: 12px; display: block; transition: transform 0.15s; }
.fold-head.is-open .fold-chev svg { transform: rotate(90deg); }
.fold-sec.worn-wearer > .fold-head .fold-label { font-weight: 700; }
/* the category heads are the mockup's rule-style section heads (no box): chevron, UPPERCASE label, a hairline filling the row, the count at the right. The row is
   30px; the 44px tap area is the button's own padding taken back with a negative margin, so the rows keep the mockup's spacing. */
.fold-sec.cat > .fold-head { gap: 8px; min-height: 44px; margin-block: -7px; padding: 7px 0; border: 0; border-radius: 0; font-size: 11.5px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; }
.fold-sec.cat > .fold-head .fold-label { flex: 0 1 auto; font-weight: 800; }
.fold-sec.cat > .fold-head .fold-chev { color: var(--sb-em); }
.fold-sec.cat > .fold-head::after { content: ""; flex: 1 1 0; min-width: 12px; height: 1px; background: var(--sb-border); }
.fold-sec.cat > .fold-head .fold-count { order: 2; margin-left: 0; letter-spacing: 0; text-transform: none; font-weight: 700; }
.inv-view { display: inline-flex; border: 1px solid var(--sb-border); border-radius: 9px; }   /* the mockup's slim toggle; the buttons' 44px tap areas reach outside it */
.inv-view button { min-height: 0; padding: 4px 9px; border: 0; background: transparent; color: var(--sb-em); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.inv-view button:first-child { border-radius: 8px 0 0 8px; } .inv-view button:last-child { border-radius: 0 8px 8px 0; }
.inv-view button[aria-pressed="true"] { background: color-mix(in srgb, var(--sb-accent) 24%, transparent); color: var(--sb-fg); }
.inv-view button:focus-visible { outline: 2px solid var(--sb-accent); outline-offset: -2px; }
.inv-grid-body { display: grid; gap: var(--sb-gap); }
.worn-folds { display: grid; gap: var(--sb-gap); }
`;
