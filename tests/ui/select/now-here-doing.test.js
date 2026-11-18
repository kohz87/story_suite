// F17/F16: Now › Here reads Doing and Wants from the same stored status and goal the dossier shows.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectNow } from '../../../ui/select/now.js';
import { gather } from '../../../ui/select/gather.js';
import { NOW_SHAPE } from '../../../ui/contract/now.js';
import { checkShape } from '../../../ui/contract/shapes.js';

const LIST = [{ id: 'np_h', name: 'Hesk', present: true, status: 'watching the inn', location: 'Inn', followed: false, meters: { trust: 1 } }, { id: 'np_q', name: 'Quill', present: true, status: null, location: 'Inn', meters: {} }];
const DOSSIERS = { np_h: { goal: 'catch the Grey Ledger bribing her inspector' }, np_q: { goal: '  ' } };
const read = (name, args) => (name === 'people.list' ? LIST : name === 'people.dossier' ? DOSSIERS[args.id] : name === 'scene.place' ? { name: 'Inn' } : null);

describe('Now › Here: doing and wants', () => {
  const now = selectNow(gather(read), {});
  it('shows the stored status as Doing and the goal as Wants, and matches the shape', () => {
    assert.deepEqual(checkShape(now, NOW_SHAPE), []);
    const hesk = now.here.find(row => row.name === 'Hesk');
    assert.equal(hesk.doing, 'watching the inn');
    assert.deepEqual(hesk.scene, { wants: 'catch the Grey Ledger bribing her inspector', hiding: null });
  });
  it('leaves both empty for someone with neither', () => {
    const quill = now.here.find(row => row.name === 'Quill');
    assert.equal(quill.doing, null);
    assert.equal(quill.scene, null);
  });
});
