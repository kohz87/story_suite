/* NPC State: the fill-in of a new person (NSD6), started after the reply's hydrate. A `+ npc` line makes a stub in the people store (the reply's own work); once the
   cache has read it, each stub of that reply that has no background yet is queued for one fill-in (queueFills, reason new-person) and the queue is started: it runs after
   the reply is shown, never before Send. One job: find the stubs and queue them. A stub is a person stamped with the reply's place (createdAt = index + 1; a scan makes
   people stamped with a clock). Each (chat, reply, swipe, person) is queued once a session, so a failed fill is not asked for again on every look; a reload asks once more. */

const seen = new Set();

/** The stubs of the reply at `index` that still need their fill: [{ id, name }]. */
export function newStubs(npcs, index) {
    return (Array.isArray(npcs) ? npcs : []).filter(npc => npc && !npc.archived && npc.createdAt === index + 1 && !String(npc.background || '').trim()).map(npc => ({ id: npc.id, name: npc.name }));
}

/** `runtime`: { getState, queueFills, processBackfills }; `at`: { index, sid, swipeKey }; `chat`: the chat key. Returns the number of fills queued. */
export function queueNewStubFills(runtime, chat, at) {
    if (!runtime || !Number.isInteger(at?.index)) return 0;
    const stubs = newStubs(runtime.getState?.()?.npcs, at.index).filter(stub => {
        const key = `${chat}|${at.sid}|${at.swipeKey}|${stub.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    if (!stubs.length || runtime.queueFills?.(stubs, at.index) !== true) return 0;
    Promise.resolve(runtime.processBackfills?.(at.index, { limit: 0, skipNpcIds: [], admissions: true })).catch(error => console.warn('[NPC State] the fill-in of a new person stopped.', error));
    return stubs.length;
}
