// The people module (NPC State): the built-in module that starts the People part, last in core/modules-list.js. Its register hook is the start
// that index.js used to give as a `late` entry; a failure is a MODULE_START Problem and the module is switched off (core/boot/register-isolated.js).
// Outside SillyTavern (tests, the testkit's boot of every built-in module) there is nothing to start.

/** The module id: not `npc-state-delta`, the id the Dossiers adapter registers under once the host is ready. */
export const PEOPLE_MODULE_ID = 'people';

const startLive = async () => {
  if (!globalThis.SillyTavern) return;
  await (await import('./legacy/bootstrap.js')).startPeople();
};

/** A people module whose register hook calls `start` (tests give their own). */
export function createPeopleModule({ start = startLive } = {}) {
  return Object.freeze({ id: PEOPLE_MODULE_ID, name: 'NPC State', version: '1.0.0', register: async () => { await start(); } });
}

/** The module, built once. */
export const peopleModule = createPeopleModule();
