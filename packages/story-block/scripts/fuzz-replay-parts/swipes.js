// The three swipe edits the fuzz makes on a reply: add one, show one, delete one.
import { date } from './messages.js';

export function newSwipe(m, text) {
  m.swipe_info[m.swipe_id] = { ...m.swipe_info[m.swipe_id], extra: structuredClone(m.extra) };
  const d = date();
  m.swipes.push(text); m.swipe_info.push({ send_date: d, extra: structuredClone(m.extra) });
  m.swipe_id = m.swipes.length - 1; m.extra = structuredClone(m.extra); m.mes = text; m.send_date = d;
}
export function showSwipe(m, i) {
  m.swipe_info[m.swipe_id] = { ...m.swipe_info[m.swipe_id], extra: structuredClone(m.extra) };
  m.swipe_id = i; m.extra = structuredClone(m.swipe_info[i].extra); m.mes = m.swipes[i]; m.send_date = m.swipe_info[i].send_date;
}
export function delSwipe(m, i) {
  m.swipes.splice(i, 1); m.swipe_info.splice(i, 1);
  const j = Math.min(i, m.swipes.length - 1);
  m.swipe_id = j; m.extra = structuredClone(m.swipe_info[j].extra); m.mes = m.swipes[j]; m.send_date = m.swipe_info[j].send_date;
}
