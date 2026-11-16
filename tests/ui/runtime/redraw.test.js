import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRedraw } from '../../../ui/runtime/redraw.js';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';

function createFakePort() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event)?.delete(fn);
    },
    emit(event, payload) {
      for (const fn of listeners.get(event) ?? []) fn(payload);
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    },
  };
}

function makeManualScheduler() {
  const queue = [];
  return {
    schedule: fn => queue.push(fn),
    runAll() {
      let runs = 0;
      while (queue.length > 0) {
        const fn = queue.shift();
        runs += 1;
        fn();
      }
      return runs;
    },
    count: () => queue.length,
  };
}

describe('createRedraw', () => {
  it('coalesces a burst of port events into one flush', () => {
    const port = createFakePort();
    const sched = makeManualScheduler();
    const redraw = createRedraw({ port, schedule: sched.schedule, initialTab: 'now' });

    let draws = 0;
    let value = 1;
    redraw.register('now:main', {
      tab: 'now',
      read: () => ({ v: value }),
      draw: () => { draws += 1; },
    });

    port.emit('head');
    port.emit('committed');
    port.emit('turn');
    port.emit('feature');

    assert.equal(sched.count(), 1);
    assert.equal(sched.runAll(), 1);
    assert.equal(draws, 1);

    redraw.destroy();
    assert.equal(port.listenerCount('head'), 0);
    assert.equal(port.listenerCount('changed'), 0);
  });

  it('skips sections whose stable digest did not change and swaps changed DOM via replaceChildren', () => {
    const document = installFakeDom();
    const port = createFakePort();
    const sched = makeManualScheduler();
    const redraw = createRedraw({ port, schedule: sched.schedule, initialTab: 'now' });

    const targetA = document.createElement('div');
    const targetB = document.createElement('div');
    let dataA = { a: 1, b: 2 };
    const dataB = { list: ['x', 'y'] };

    let rendersA = 0;
    let rendersB = 0;

    redraw.register('now:a', {
      tab: 'now',
      target: targetA,
      read: () => dataA,
      render: vm => {
        rendersA += 1;
        const el = document.createElement('span');
        el.textContent = `A:${vm.a}`;
        return el;
      },
    });

    redraw.register('chat:b', {
      tab: 'chat',
      target: targetB,
      read: () => dataB,
      render: vm => {
        rendersB += 1;
        const el = document.createElement('span');
        el.textContent = `B:${vm.list.join(',')}`;
        return el;
      },
    });

    const first = redraw.flush();
    assert.deepEqual(first, { drawn: ['now:a', 'chat:b'], skipped: [], failed: [] });
    assert.equal(targetA.textContent, 'A:1');
    assert.equal(targetB.textContent, 'B:x,y');

    // Reorder object keys without changing values -> digest must still match.
    dataA = { b: 2, a: 1 };
    port.emit('committed');
    sched.runAll();
    assert.equal(rendersA, 1);
    assert.equal(rendersB, 1);

    // Mutate only A -> only A redraws.
    dataA = { a: 9, b: 2 };
    port.emit('committed');
    sched.runAll();
    assert.equal(rendersA, 2);
    assert.equal(rendersB, 1);
    assert.equal(targetA.textContent, 'A:9');
  });

  it('marks only visible tab and chat surfaces dirty, and refreshes hidden tabs when shown', () => {
    const port = createFakePort();
    const sched = makeManualScheduler();
    const redraw = createRedraw({ port, schedule: sched.schedule, initialTab: 'now' });

    const seen = [];
    redraw.register('now:card', { tab: 'now', read: () => 1, draw: () => seen.push('now') });
    redraw.register('bag:list', { tab: 'bag', read: () => 2, draw: () => seen.push('bag') });
    redraw.register('chat:row', { tab: 'chat', read: () => 3, draw: () => seen.push('chat') });

    port.emit('head');
    assert.deepEqual(redraw.pending(), ['chat:row', 'now:card']);
    sched.runAll();
    assert.deepEqual(seen, ['now', 'chat']);

    redraw.setVisibleTab('bag');
    assert.deepEqual(redraw.pending(), ['bag:list']);
    sched.runAll();
    assert.deepEqual(seen, ['now', 'chat', 'bag']);
  });

  it('filters by keys on changed(keys) and defers flushes while hold() is active', () => {
    const port = createFakePort();
    const sched = makeManualScheduler();
    const redraw = createRedraw({ port, schedule: sched.schedule, initialTab: 'now' });

    const drawn = [];
    let hp = 1;
    redraw.register('s1', { tab: 'now', keys: ['hp'], read: () => hp, draw: () => drawn.push('s1') });
    redraw.register('s2', { tab: 'now', keys: ['bag'], read: () => 2, draw: () => drawn.push('s2') });
    redraw.flush();
    drawn.length = 0;

    const release1 = redraw.hold();
    const release2 = redraw.hold();

    hp = 2;
    port.emit('changed', ['hp']);
    assert.equal(sched.count(), 0);
    assert.deepEqual(redraw.flush(), { drawn: [], skipped: [], failed: [] });

    release1();
    release1(); // idempotent
    assert.equal(sched.count(), 0);

    release2();
    assert.equal(sched.count(), 1);
    sched.runAll();
    assert.deepEqual(drawn, ['s1']);
  });

  it('captures section errors in failed without aborting other sections', () => {
    const sched = makeManualScheduler();
    const redraw = createRedraw({ schedule: sched.schedule, initialTab: 'now' });

    redraw.register('bad', {
      tab: 'now',
      read: () => 1,
      draw: () => { throw new Error('boom'); },
    });
    redraw.register('good', {
      tab: 'now',
      read: () => 2,
      draw: () => {},
    });

    const result = redraw.flush();
    assert.deepEqual(result.drawn, ['good']);
    assert.deepEqual(result.failed, [{ id: 'bad', message: 'boom' }]);

    redraw.unregister('bad');
    assert.deepEqual(redraw.pending(), []);
  });
});

describe('createRedraw drawn sections and flushNow', () => {
  it('a drawn section seeds its digest and is not drawn until it changes', () => {
    const sched = makeManualScheduler();
    const redraw = createRedraw({ schedule: sched.schedule, initialTab: 'now' });
    let value = 1;
    let draws = 0;
    redraw.register('pane', { tab: 'now', drawn: true, read: () => value, draw: () => { draws += 1; } });
    assert.deepEqual(redraw.pending(), []);
    assert.equal(redraw.flush().drawn.length, 0);
    redraw.changed([]);
    sched.runAll();
    assert.equal(draws, 0);
    value = 2;
    redraw.changed([]);
    sched.runAll();
    assert.equal(draws, 1);
  });

  it('a section registered without drawn is still drawn once', () => {
    const redraw = createRedraw({ schedule: () => {}, initialTab: 'now' });
    let draws = 0;
    redraw.register('pane', { tab: 'now', read: () => 1, draw: () => { draws += 1; } });
    redraw.flush();
    assert.equal(draws, 1);
  });

  it('flushNow draws pending sections synchronously', () => {
    const sched = makeManualScheduler();
    const redraw = createRedraw({ schedule: sched.schedule, initialTab: 'now' });
    let drawn = 0;
    redraw.register('pane', { tab: 'now', read: () => 1, draw: () => { drawn += 1; } });
    const result = redraw.flushNow();
    assert.deepEqual(result.drawn, ['pane']);
    assert.equal(drawn, 1);
    sched.runAll();
    assert.equal(drawn, 1);
  });
});

describe('createRedraw carry-overs (J11 step 3)', () => {
  it('flushNow draws while a hold is open; the hold stays open and later marks wait for it', () => {
    const sched = makeManualScheduler();
    const redraw = createRedraw({ schedule: sched.schedule, initialTab: 'now' });
    let value = 1;
    const seen = [];
    redraw.register('pane', { tab: 'now', read: () => value, draw: vm => seen.push(vm) });
    const release = redraw.hold();
    redraw.markDirty();
    assert.deepEqual(redraw.flush().drawn, [], 'a plain flush waits for the hold');
    redraw.markDirty();
    assert.deepEqual(redraw.flushNow().drawn, ['pane'], 'flushNow draws through the hold');
    value = 2;
    redraw.markDirty();
    sched.runAll();
    assert.deepEqual(seen, [1], 'still held after flushNow');
    release();
    sched.runAll();
    assert.deepEqual(seen, [1, 2]);
  });

  it('a drawn section whose read() throws: register does not throw and the section is drawn on the next flush', () => {
    const redraw = createRedraw({ schedule: () => {}, initialTab: 'now' });
    let reads = 0;
    const drawn = [];
    assert.doesNotThrow(() => redraw.register('pane', {
      tab: 'now', drawn: true,
      read: () => { reads += 1; if (reads === 1) throw new Error('not ready'); return 5; },
      draw: vm => drawn.push(vm),
    }));
    assert.deepEqual(redraw.pending(), ['pane']);
    assert.deepEqual(redraw.flush().drawn, ['pane']);
    assert.deepEqual(drawn, [5]);
  });
});

