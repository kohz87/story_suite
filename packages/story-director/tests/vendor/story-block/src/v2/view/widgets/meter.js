// meter: a labelled bar for a value out of a maximum (HP 77/82, XP to next level, a clock's segments).
//
// The fill width is the custom property `--ss-w-ratio` (0…1) on the track, so a screen's CSS decides how
// it looks. With `segments`, the bar is drawn as that many cells, the filled ones marked `ss-w-on`
// (and the one partly filled `ss-w-part`), e.g. charges, pips or a four-part clock.
//
// Marks on the track, each placed by a custom property (0…1 of the range) so CSS decides how it looks:
// * `ceiling`: a notch where the value can go no higher for now (max HP lowered by a wound); the part
//   of the track above it is shaded (`--ss-w-ceiling`).
// * `ticks: [{ at, label }]`: stage marks (a relationship's Wary / Friendly / Close); the stage reached is
//   the last tick at or below the value, named in the head (`ss-w-meter-stage`).
// * `delta`: the change since the last reply, ▲3 or ▼5 in the head (`ss-w-up` / `ss-w-down`).
// * `warnBelow` / `warnAbove`: the critical bands at either end (`--ss-w-warn-lo`, `--ss-w-warn-hi`);
//   a value inside one marks the meter `ss-w-critical` (and the band it is in `ss-w-in`).
// Each is left out when not given or outside the range; the spoken value names them in words.
//
// Public face: re-exports its parts.

export { meterRatio, meterCells } from './meter-parts/ratio.js';
export { meterTicks, meterStage, meterWarning, deltaText } from './meter-parts/marks.js';
export { meter } from './meter-parts/widget.js';
