// The job: the pairing check's answer in the reader's words: one short line per kind of problem, counted, each saying what is switched off.

const plural = (n, one, many) => (n === 1 ? one : many);
const quoted = error => /"([^"]+)"/.exec(String(error.message ?? ''))?.[1] ?? '';

/** The one line for the events (or event templates) a calendar cannot fire: `n` of them; the date or season is named when there is just one. */
function eventLine(errors, noun) {
  if (errors.length !== 1) return `${errors.length} ${noun}s never fire: their dates or seasons are not on this calendar.`;
  const text = quoted(errors[0]);
  const date = /date:\d+-([^-"\s]+)-(\d+)/.exec(text);
  const season = /season:([^"\s]+)/.exec(text);
  if (date) return `1 ${noun} never fires: its date, day ${Number(date[2])} of month ${/^\d+$/.test(date[1]) ? Number(date[1]) : date[1]}, is not on this calendar.`;
  if (season) return `1 ${noun} never fires: its season, ${season[1]}, is not on this calendar.`;
  return `1 ${noun} never fires: its date or season is not on this calendar.`;
}

function startLine(error, { world, game, date }) {
  const calendar = game?.name ?? 'Built-in';
  const fallback = `${world?.name ?? 'the world'} starts on day 1 of month 1, ${date?.year ?? ''}`.replace(/, $/, '');
  if (/ days in /.test(String(error.message))) return `Start date: month ${date?.month} of ${calendar} has no day ${date?.day}, so ${fallback}.`;
  return `Start date: ${calendar} has no month ${date?.month}, so ${fallback}.`;
}

/**
 * `pairing` = the `packs.pairing` answer. → `[{ level: 'error' | 'warning', text }]`, problems first: the start date, the events and event templates that never fire,
 * the birthdays that are dropped, the name lists left unused. Nothing for a pair that fits (the page adds the "fit" or "suggests" note).
 */
export function pairLines(pairing) {
  const view = pairing && typeof pairing === 'object' ? pairing : {};
  const errors = Array.isArray(view.errors) ? view.errors : [], warnings = Array.isArray(view.warnings) ? view.warnings : [];
  const out = [];
  for (const error of errors.filter(item => item.code === 'PAIR_START_DATE')) out.push({ level: 'error', text: startLine(error, view) });
  const events = errors.filter(item => item.part?.kind === 'event'), templates = errors.filter(item => item.part?.kind === 'template');
  if (events.length) out.push({ level: 'error', text: eventLine(events, 'world event') });
  if (templates.length) out.push({ level: 'error', text: eventLine(templates, 'event template') });
  const birthdays = warnings.filter(item => item.code === 'PAIR_BIRTHDAY');
  if (birthdays.length) out.push({ level: 'warning', text: `${birthdays.length} ${plural(birthdays.length, 'birthday is', 'birthdays are')} dropped: ${plural(birthdays.length, 'its month is', 'their months are')} not on this calendar.` });
  const cultures = warnings.filter(item => item.code === 'PAIR_CULTURE');
  if (cultures.length === 1) {
    const region = /\(([^)]*)\)\. It is unused/.exec(String(cultures[0].message))?.[1] ?? '';
    out.push({ level: 'warning', text: `1 name list is unused: its region${region.includes(',') ? 's' : ''}, ${region || 'its region'}, ${region.includes(',') ? 'are' : 'is'} not in ${view.world?.name ?? 'the world'}.` });
  } else if (cultures.length) out.push({ level: 'warning', text: `${cultures.length} name lists are unused: their regions are not in ${view.world?.name ?? 'the world'}.` });
  return out;
}
