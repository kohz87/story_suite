// `reply.changes`: what one reply changed, for the ✦ reply menu and the inline row under it. Built only from the reply's own receipts
// (tools.receipts) and the state the query is asked on, so a swipe, a middle delete, a rewind, a reload and an edited Re-read answer as a rebuild does.

const ITEM = 'capture.item';
const COIN = 'capture.coin';
const PLACE = 'capture.place';
const PRESENT = 'capture.present';
const SHOWN = new Set([ITEM, COIN, PLACE, PRESENT]);

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');
const whole = value => Number.isSafeInteger(value) && value > 0;

const headOf = headIndex => {
    try { return typeof headIndex === 'function' ? headIndex() : -1; } catch { return -1; }
};

function receiptsAt(tools, index) {
    let list = [];
    try { list = typeof tools?.receipts === 'function' ? tools.receipts() ?? [] : []; } catch { list = []; }
    // The reader's own edits are not the reply's changes (a `ui` receipt); every other cause is.
    return list.filter(entry => entry?.index === index && isRec(entry.receipt) && SHOWN.has(entry.receipt.type) && entry.receipt.cause !== 'ui').map(entry => entry.receipt);
}

// The name an item definition shows: the state's own, else the id without its pack prefix.
const nameOf = (state, def) => text(state?.domains?.inventory?.defs?.[def]?.name) || text(def).replace(/^[^/]*\//, '');

function itemLines(receipts, state) {
  const net = new Map();
  for (const receipt of receipts.filter(item => item.type === ITEM)) {
    const data = isRec(receipt.data) ? receipt.data : {};
    if (!whole(data.qty) || !text(data.def)) continue;
    // A removal says how many are left (`left`); an add does not.
    const signed = Number.isFinite(data.left) ? -data.qty : data.qty;
    net.set(data.def, (net.get(data.def) ?? 0) + signed);
  }
  return [...net].filter(([, qty]) => qty !== 0).map(([def, qty]) => ({ glyph: 'item', line: `${qty > 0 ? '+' : '−'}${Math.abs(qty)} ${nameOf(state, def)}`, detail: null, applied: true }));
}

function coinLines(receipts) {
  let total = 0;
  for (const receipt of receipts.filter(item => item.type === COIN)) {
    const amount = receipt.data?.amount;
    // `wallet.receive` says "receives"; a payment says "pays" (the money guard reads it the same way).
    if (Number.isSafeInteger(amount)) total += / receives /u.test(text(receipt.summary)) ? amount : -amount;
  }
  return total === 0 ? [] : [{ glyph: 'coin', line: `${total > 0 ? '+' : '−'}${Math.abs(total)}`, detail: null, applied: true }];
}

function sceneLines(receipts) {
  const lines = [];
  const moved = receipts.filter(item => item.type === PLACE && item.data?.moved === true && text(item.data.name)).pop();
  if (moved) lines.push({ glyph: 'road', line: `To ${text(moved.data.name)}`, detail: null, applied: true });
  const here = new Map();
  for (const receipt of receipts.filter(item => item.type === PRESENT)) {
    for (const name of Array.isArray(receipt.data?.added) ? receipt.data.added : []) if (text(name)) here.set(text(name), 'arrived');
    for (const name of Array.isArray(receipt.data?.removed) ? receipt.data.removed : []) if (text(name)) here.set(text(name), 'left');
  }
  for (const [name, what] of here) lines.push({ glyph: 'people', line: `${name} ${what}`, detail: null, applied: true });
  return lines;
}

/**
 * `reply.changes({ index? })` → { lines: [{ glyph, line, detail, applied }], refused: [], stateThen: { place, weather } } for reply `index`
 * (the head reply by default), or null when the reply has no receipts (the card hides). `refused` is [] here: the lines a reply did not use
 * are told by the turn once and kept nowhere a reload can read. `stateThen` is the place and weather of the state the query is asked on
 * (`{ asOf: index }` gives that reply's own).
 */
export function replyChanges(state, args, tools, headIndex) {
  const wanted = isRec(args) && Number.isInteger(args.index) ? args.index : headOf(headIndex);
  if (!Number.isInteger(wanted) || wanted < 0) return null;
  const receipts = receiptsAt(tools, wanted);
  if (!receipts.length) return null;
  let weather = null;
  try { weather = tools?.hasQuery?.('scene.weather') ? text(tools.query('scene.weather')?.text) || null : null; } catch { weather = null; }
  return {
    lines: [...itemLines(receipts, state), ...coinLines(receipts), ...sceneLines(receipts)],
    refused: [],
    stateThen: { place: text(state?.domains?.scene?.place?.name), weather },
  };
}
