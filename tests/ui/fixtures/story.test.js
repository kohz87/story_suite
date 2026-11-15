import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildStory } from '../../../ui/fixtures/story.js';

describe('buildStory', () => {
  it('plan hidden (default): counts only, no plan text, no agenda or secret text', () => {
    const vm = buildStory();
    assert.equal(vm.plan.shown, false);
    assert.equal(vm.arc.plan, null);
    assert.equal(vm.arc.accepted, 'Goldwane 12');
    for (const key of ['beats', 'clocks', 'hooks', 'newsOnWay', 'agendas', 'secrets', 'ripples']) {
      assert.deepEqual(vm[key].items, [], key);
    }
    assert.equal(vm.beats.count, 3);
    assert.equal(vm.clocks.count, 2);
    assert.equal(vm.agendas.count, 7);
    assert.equal(vm.secrets.count, 3);
    assert.equal(vm.ripples.count, 3);
  });

  it('plan hidden: the pulse keeps skip reasons but not what a roll was or caused', () => {
    const { pulse } = buildStory();
    assert.equal(pulse.latest.roll, 14);
    assert.equal(pulse.latest.kind, null);
    assert.equal(pulse.latest.cause, null);
    const skipped = pulse.recent.filter(r => r.skipped);
    assert.deepEqual(skipped.map(r => r.text), ['quiet scene', 'resting']);
    assert.ok(pulse.recent.filter(r => !r.skipped).every(r => r.text === '' && r.effect === null));
  });

  it('plan shown: the arc, beats, agendas, secrets and ripples are filled', () => {
    const vm = buildStory({ planShown: true });
    assert.equal(vm.arc.plan.title, 'The Grey Toll');
    assert.equal(vm.beats.items.length, 3);
    assert.equal(vm.beats.items[0].state, 'ready');
    assert.equal(vm.agendas.items.length, 7);
    assert.equal(vm.secrets.items[0].personId, 'temiwa');
    assert.deepEqual(vm.ripples.items.map(r => r.sway), [40, 35, 25]);
    assert.equal(vm.pulse.latest.kind, 'Rumour');
    assert.equal(vm.pulse.recent[0].effect, 'rumour recorded');
  });

  it('agendas: closest to you first, the first four told this reply', () => {
    const { items } = buildStory({ planShown: true }).agendas;
    assert.equal(items[0].why, 'heading your way');
    assert.deepEqual(items.map(a => a.toldThisReply), [true, true, true, true, false, false, false]);
    assert.ok(items.every(a => a.step <= a.of));
  });

  it('cast shows counts only: 6 in the pack, 2 met, 4 unmet, no names', () => {
    const { cast } = buildStory({ planShown: true });
    assert.deepEqual(Object.keys(cast).sort(), ['lastMoved', 'met', 'total', 'unmet']);
    assert.equal(cast.total, cast.met + cast.unmet);
  });

  it('quiet scene: no latest roll, mode stays lively', () => {
    const { pulse } = buildStory({ quiet: true });
    assert.equal(pulse.quiet, true);
    assert.equal(pulse.latest, null);
    assert.equal(pulse.mode, 'lively');
  });

  it('trackers: two drawn, one pinned to Now, one more hidden by the pack and only counted', () => {
    const vm = buildStory();
    assert.deepEqual(vm.trackers.map(t => [t.id, t.showOnNow]), [['chapel-debt', true], ['ships-stores', false]]);
    assert.equal(vm.trackersHidden, 1);
    assert.deepEqual(vm.trackers[0].fields.map(f => f.kind), ['bar', 'bar', 'text']);
  });

  it('empty: nothing to show, zero counts, trackers empty', () => {
    const vm = buildStory({ empty: true, planShown: true });
    assert.equal(vm.plan.shown, true);
    assert.equal(vm.beats.count, 0);
    assert.deepEqual(vm.agendas, { count: 0, items: [] });
    assert.deepEqual(vm.cast, { total: 0, met: 0, unmet: 0, lastMoved: null });
    assert.deepEqual(vm.trackers, []);
    assert.equal(vm.trackersHidden, 0);
    assert.equal(vm.arc.plan, null);
  });

  it('calls return fresh copies', () => {
    const a = buildStory({ planShown: true });
    a.beats.items[0].title = 'changed';
    a.trackers[0].fields[0].value = 'changed';
    const b = buildStory({ planShown: true });
    assert.equal(b.beats.items[0].title, 'Temiwa’s request');
    assert.equal(b.trackers[0].fields[0].value, '120 silver');
  });
});
