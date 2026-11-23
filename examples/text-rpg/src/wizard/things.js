// What a saved character carried, added after Create the way the RPG's Create adds it (best effort: the character is made whatever happens here): one `inventory.add` for each thing, its carry, then the purse raised by the file's money.
import { W, fill } from './words.js';

const why = answer => String(answer?.message ?? W.generic);

/**
 * `call(type, payload)` is the widget api's command (it answers { ok, … }; a throw counts as a refusal), `query(name, args)` its read. → the sentences for what could not be added ([] when all went in).
 */
export async function addThings(file, call, query) {
  const failed = [];
  const send = async (type, payload) => { try { return (await call(type, payload)) ?? { ok: false }; } catch (error) { return { ok: false, message: String(error?.message ?? error) }; } };
  for (const item of file.items ?? []) {
    const { carry, ...fields } = item;
    const added = await send('inventory.add', { ...fields, owner: 'party', starting: true });
    const stack = added.data?.stacks?.[0] ?? added.receipt?.data?.stacks?.[0];
    if (added.ok && carry && stack) await send('inventory.carry', { stack, carry });
    if (!added.ok) failed.push(fill(W.notAdded, { what: `${item.name}${item.qty === 1 ? '' : ` ×${item.qty}`}`, why: why(added) }));
  }
  if (file.money > 0) {
    let purse = null;
    try { purse = query?.('inventory.wallet', { owner: 'party' })?.coin; } catch { purse = null; }
    const set = await send('wallet.set', { owner: 'party', amount: (Number.isSafeInteger(purse) ? purse : 0) + file.money, starting: true });
    if (!set.ok) failed.push(fill(W.moneyNotAdded, { why: why(set) }));
  }
  return failed;
}
