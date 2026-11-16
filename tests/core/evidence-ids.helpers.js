import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { T1, director, sampleModule, hostModule } from '../../packages/story-block/tests/v2/helpers/evidence.js';

export const ids = list => list.map(each => each.id);
export const steps = ask => ask({}).filter(proof => proof.payload.after === 'dependent');
export const rerunOf = h => (state, receipt, info) => {
    const plan = info.replan ?? { type: receipt.type, payload: receipt.replan?.payload ?? {}, seed: receipt.seed };     // (as turn.js planAgain)
    return h.bus.run(plan.type, plan.payload, {
        cause: 'system', state, seed: plan.seed, replacing: info.span.evidence ?? [], occurrence: info.occurrence,
        reply: { index: info.index, sid: h.store.carrierSid(info.index), ordinal: info.span.source?.ordinal },
    });
};

export async function open(t) {
    const link = hostModule();
    const wanted = ['a', 'b'];
    const host = await createHost({ modules: [link.def, director({ after: 'each', wanted }), sampleModule()], core: false });
    t.after(() => host.close());
    link.link(host.store);
    const ask = args => host.sdk.query('story.evidence', args);
    // Three replies that each give a proof (a visit), and a fourth whose afterCapture asks for a step on each wanted one.
    for (const place of ['a', 'b', 'c']) {
        await host.send('Go on.', `Narration of ${place}.`);
        const made = host.bus.command('sd.many', { specs: [{ kind: 'visit', payload: { place } }] }, { cause: 'ui' });
        assert.equal(made.ok, true, made.message);
    }
    await host.send('Sure, I accept the job. Thanks a lot!', `The last narration.\n\n<Changes>\n! accept ${T1} | words: Sure, I accept the job\n</Changes>`);
    return { host, ask, wanted };
}
