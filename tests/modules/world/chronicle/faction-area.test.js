// B18: `+ faction Name — about | area | stance: wary` stores the area from the second unlabelled part (marked replies only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';

const LINE = '+ faction Saltreach Runners — quay smugglers | Bluewatch Village | stance: wary';
const factions = host => Object.values(host.head().domains.chronicle.factions);

test('the second part of a faction line is its area, not part of the summary', async () => {
    const host = await createHost({ modules: [createModule()] });
    await host.send('Hi.', `x\n<Changes>\n${LINE}\n</Changes>`);
    assert.deepEqual(factions(host).map(f => [f.summary, f.area, f.stance]), [['quay smugglers', 'Bluewatch Village', 'wary']]);
    host.close();
});

test('a labelled area still wins, and a summary that only has one part is untouched', async () => {
    const host = await createHost({ modules: [createModule()] });
    await host.send('Hi.', 'x\n<Changes>\n+ faction Red Cord — hired knives; they cut | area: the quay\n+ faction Grey Men — watchers\n</Changes>');
    assert.deepEqual(factions(host).map(f => [f.name, f.summary, f.area]), [['Red Cord', 'hired knives; they cut', 'the quay'], ['Grey Men', 'watchers', '']]);
    host.close();
});
