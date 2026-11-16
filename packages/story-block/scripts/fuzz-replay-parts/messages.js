// Fake SillyTavern messages for the fuzz: a user line and a reply, each dated a minute after the last.

let clock = 1700000000000;
export const date = () => new Date(clock += 60000).toISOString();
export const user = text => ({ name: 'You', is_user: true, mes: text, send_date: date(), extra: {} });
export const reply = text => { const d = date(); return { name: 'N', is_user: false, mes: text, send_date: d, swipe_id: 0, swipes: [text], swipe_info: [{ send_date: d, extra: {} }], extra: {} }; };
