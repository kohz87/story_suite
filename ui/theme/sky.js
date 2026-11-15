// Time-of-day backdrop gradient (pack art replaces it).

const SKIES = Object.freeze({
  dark: Object.freeze({
    night: 'linear-gradient(180deg,#0c1022 0%,#161c36 42%,#242947 78%,#151728 100%)',
    dawn: 'linear-gradient(180deg,#232b4f 0%,#4b426b 38%,#8a6276 72%,#36293d 100%)',
    morning: 'linear-gradient(180deg,#2c3f66 0%,#3d5a86 30%,#7a86a8 62%,#2a2d45 100%)',
    afternoon: 'linear-gradient(180deg,#24456e 0%,#3b6b9c 36%,#6f8fb0 72%,#26314a 100%)',
    dusk: 'linear-gradient(180deg,#222548 0%,#50365e 36%,#8c5664 70%,#2a2238 100%)',
  }),
  light: Object.freeze({
    night: 'linear-gradient(180deg,#3d496e 0%,#5f6b94 42%,#939bb8 78%,#7c819e 100%)',
    dawn: 'linear-gradient(180deg,#8799cb 0%,#c7a6c4 40%,#f2cfc2 75%,#ded1df 100%)',
    morning: 'linear-gradient(180deg,#8fb2e0 0%,#b9d0ec 40%,#efe4d8 75%,#d8d3e6 100%)',
    afternoon: 'linear-gradient(180deg,#6fa3db 0%,#9ec7eb 42%,#e8edf2 78%,#cedae8 100%)',
    dusk: 'linear-gradient(180deg,#7a88b8 0%,#b895b8 38%,#ecc0a8 74%,#c9bfd4 100%)',
  }),
});

function parseHour(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return ((input % 24) + 24) % 24;
  }
  if (input && typeof input === 'object') {
    if (typeof input.hour === 'number') return parseHour(input.hour);
    if (input.time !== undefined) return parseHour(input.time);
  }
  if (typeof input === 'string') {
    const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(input);
    if (m) {
      let hour = Number(m[1]);
      const meridiem = m[3]?.toLowerCase();
      if (meridiem === 'am' && hour === 12) hour = 0;
      else if (meridiem === 'pm' && hour < 12) hour += 12;
      if (hour >= 0 && hour <= 23) return hour;
    }
  }
  return null;
}

function bandFor(hour) {
  if (hour === null) return 'morning';
  if (hour >= 21 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'dusk';
}

/**
 * Returns the CSS backdrop gradient for a time of day and colour scheme ('dark' or 'light').
 */
export function skyFor(time, scheme = 'dark') {
  const palette = scheme === 'light' ? SKIES.light : SKIES.dark;
  return palette[bandFor(parseHour(time))];
}
