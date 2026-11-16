// The owner's rule for story-action buttons (CLAUDE.md non-negotiable 6). Change it here, nowhere else.

const own = Object.freeze(['story-block/fight']);

export const STORY_ACTION_POLICY = Object.freeze({
    choosers: 'own',
    partyKinds: own,
    othersBy: 'code-or-model',
});

const titleOf = kindId => {
    const tail = String(kindId ?? 'interaction').split('/').at(-1).replace(/[-_]+/gu, ' ').trim();
    return tail ? tail[0].toUpperCase() + tail.slice(1) : 'interaction';
};

const refusal = (kindId, detail) => ({ code: 'NOT_YOURS', message: detail || `You cannot choose that in the ${titleOf(kindId)}.` });

/** Null when the reader may choose this input under the supplied or recorded policy. */
export function policyProblem(policy, kindId, actors, input) {
    const list = Array.isArray(actors) ? actors : [];
    const player = list.find(actor => actor?.player === true) ?? null;
    const title = titleOf(kindId);
    if (!player) return refusal(kindId, `Your own character is not on the ${title}.`);
    const wanted = String(input?.actor ?? '');
    const actor = list.find(item => String(item?.id ?? '') === wanted) ?? null;
    if (!actor) return refusal(kindId, `That actor is not on the ${title}.`);
    const party = policy?.party === true || policy?.choosers === 'party' || (Array.isArray(policy?.partyKinds) && policy.partyKinds.includes(kindId));
    if (party ? actor.party !== true : actor.player !== true) {
        return refusal(kindId, party
            ? `You can only choose for your party in the ${title}.`
            : `You can only choose for your own character in the ${title}.`);
    }
    return null;
}
