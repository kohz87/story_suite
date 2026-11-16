// The Focus-only and tone styles added to the map's stylesheet.

import { MAP_CARD_BESIDE_MIN, MAP_CARD_MIN } from '../relationship-map-core.js';

// Focus-only and tone styles, added to the map's stylesheet.
export function focusStyles(root) {
    return `
${root} .delta-map-pane { --map-good:var(--delta-good); --map-bad:var(--delta-danger); --map-gold:var(--delta-warn); --map-grey:rgba(255,255,255,.34); }
${root} [data-tone="good"] { --tone:var(--map-good); } ${root} [data-tone="bad"] { --tone:var(--map-bad); } ${root} [data-tone="gold"] { --tone:var(--map-gold); } ${root} [data-tone="grey"] { --tone:var(--map-grey); }
${root} .delta-map-bond { stroke:var(--tone,var(--map-grey)); stroke-dasharray:5 4; opacity:.9; }
${root} .delta-map-bond-solid { stroke-dasharray:none; stroke-width:3; }
${root} .delta-map-node[data-focus="dim"] { opacity:.22; }
${root} .delta-map-node[data-focus="focus"] .delta-map-avatar { box-shadow:0 0 0 4px rgba(216,188,120,.25); }
${root} .delta-map-word { color:color-mix(in srgb, var(--tone) 75%, var(--delta-text)); font-size:var(--dt-kick); font-weight:700; line-height:1.2; }
${root} .delta-map-focus-chip { display:inline-flex; align-items:center; gap:6px; min-height:34px; padding:0 4px 0 12px; border:1px solid var(--delta-accent); border-radius:999px; color:var(--delta-text); font-size:var(--dt-meta); }
${root} .delta-map-focus-clear { min-width:30px; min-height:30px; border:0; border-radius:50%; color:var(--delta-text); background:transparent; cursor:pointer; }
/* the card: under the map (phone) it is a face, name and one line, or in Focus the "Rika's ties" block; beside the map (when the circle and
   the card both fit, MAP_CARD_BESIDE_MIN) it is the mockup's side card: the dial, name, pills, numbers, the ties, Open dossier */
${root} .delta-map-card { flex:none; display:grid; justify-items:start; align-content:start; gap:clamp(6px,1cqw,10px); min-width:0; padding:clamp(10px,2cqw,16px) clamp(10px,3cqw,18px); border-top:1px solid var(--delta-line); font-size:var(--dt-body); }
${root} .delta-map-card .delta-map-beside { display:none; }
${root} .delta-map-card-who { display:flex; align-items:center; gap:10px; min-width:0; }
${root} .delta-map-card-who > p { margin:0; min-width:0; font-size:var(--dt-meta); color:var(--delta-muted); overflow-wrap:anywhere; }
${root} .delta-map-card-who > p > b { color:var(--delta-text); font-size:var(--dt-body); }
${root} .delta-map-card-face { flex:none; display:block; width:clamp(36px,10cqw,52px); aspect-ratio:1; overflow:hidden; border:2px solid var(--delta-accent); border-radius:50%; background:var(--face-flat, #3a3740); }
${root} .delta-map-card-img { display:block; width:100%; height:100%; object-fit:cover; object-position:center 12%; }
${root} .delta-map-card-img.delta-portrait-placeholder { display:grid; place-items:center; color:var(--delta-muted); font:700 clamp(12px,3.4cqw,18px)/1 var(--ss-font, system-ui, sans-serif); }
${root} .delta-map-ties { margin:0; display:grid; gap:4px; min-width:0; justify-self:stretch; font-size:var(--dt-meta); color:var(--delta-muted); line-height:1.5; }
${root} .delta-map-ties-head { display:block; font-size:var(--dt-kick); letter-spacing:.12em; text-transform:uppercase; color:var(--aff, var(--delta-accent)); }
${root} .delta-map-ties-inline { margin:0; color:var(--delta-text); font-size:var(--dt-body); }
${root} .delta-map-ties-focus .delta-map-ties-head { font-size:var(--dt-body); letter-spacing:0; text-transform:none; color:var(--delta-text); }
${root} .delta-map-tie > [data-tone] { color:color-mix(in srgb, var(--tone) 78%, var(--delta-text)); }
${root} .delta-map-ties-rows { display:grid; gap:clamp(5px,.8cqw,9px); }
${root} .delta-map-ties-rows .delta-map-tie { display:block; }
${root} .delta-map-ties-rows .delta-map-tie b { color:var(--delta-text); }
${root} .delta-map-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
${root} .delta-map-card-empty .delta-map-card-line { margin:0; }
${root} .delta-map-card-line > i { display:inline-block; margin-right:.5em; font-style:normal; white-space:nowrap; }   /* whole items that wrap whole */
${root} .delta-map-card-line > i:not(:last-child)::after { content:" ·"; }
@container dsr (min-width: ${MAP_CARD_BESIDE_MIN}px) {
  ${root} .delta-map-body { display:grid; grid-template-columns:minmax(0,1fr) clamp(${MAP_CARD_MIN}px,28cqw,360px); grid-template-rows:minmax(0,1fr); overflow:hidden; }
  ${root} .delta-map-stage { min-height:0; display:grid; grid-template-rows:minmax(0,1fr); padding-bottom:14px; }
  ${root} .delta-map-frame { container-type:size; }
  ${root} .delta-map { width:min(100cqw,100cqh); max-width:none; }
  ${root} .delta-map-card { justify-items:center; text-align:center; overflow:auto; padding:clamp(14px,2cqw,24px) clamp(12px,1.6cqw,20px); border-top:0; border-left:1px solid var(--delta-line); }
  ${root} .delta-map-card .delta-map-stacked, ${root} .delta-map-ties-focus .delta-map-ties-inline { display:none; }
  ${root} .delta-map-card .delta-map-beside { display:block; }
  ${root} .delta-map-card-dial { display:grid; width:min(100%,clamp(150px,18cqw,270px)); padding:0; border:0; background:none; color:inherit; font:inherit; cursor:pointer; }
  ${root} .delta-map-card-dial .dossier-dial { width:100%; }
  ${root} .delta-map-card-dial .dial-label { display:none; }   /* the card's numbers line carries the values; the board's labels would draw at 4-5px here */
  ${root} .delta-map-ties-focus .delta-map-ties-head { font-size:var(--dt-kick); letter-spacing:.12em; text-transform:uppercase; color:var(--aff, var(--delta-accent)); }   /* beside the map: the small coloured caps like Bonds on the map */
  ${root} .delta-map-card-name { margin:2px 0 0 !important; padding:0 !important; border:0 !important; text-align:center !important; font-size:clamp(20px,1.2cqw + 12px,30px); line-height:1.1; font-weight:600; color:var(--delta-text); text-transform:none; letter-spacing:0; overflow-wrap:anywhere; }
  ${root} .delta-map-card-pills { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; }
  ${root} .delta-map-card-line { margin:0; color:var(--delta-muted); font-size:var(--dt-meta); }
  ${root} .delta-map-ties { text-align:left; }
}
${root} .delta-map-key-line { margin:0; color:var(--delta-muted); font-size:var(--dt-meta); }
`;
}
