// A small world pack that uses every kind of reference site, for the Studio's reference and rename tests.

export const SMALL = () => ({
    id: 'small', name: 'Small',
    content: {
        regions: [{ id: 'the-fen', name: 'The Fen', aliases: ['Marsh'] }],
        realms: [{ id: 'fen-realm', name: 'Fen Realm', regions: ['the-fen'] }],
        places: [{ id: 'fenhold', name: 'Fenhold', region: 'the-fen' }, { id: 'reedmoor', name: 'Reedmoor', aliases: ['The Moor'], region: 'Marsh' }],
        routes: [{ from: 'fenhold', to: 'reedmoor' }, { name: 'Old Causeway', from: 'Fenhold', to: 'The Moor' }],
        cast: [{ kind: 'companion', id: 'wren', name: 'Wren', start: { place: 'fenhold' }, ties: [{ with: 'tam', tag: 'friend' }], secrets: [{ id: 'lamp', gate: 'fired:flood and meter trust >= 40 of tam or fact:lit and place:reedmoor', text: 'x', writes_fact: 'wren-knows' }] },
            { kind: 'figure', id: 'tam', name: 'Tam', keyRelationships: [{ id: 'wren', text: 'kin' }] }],
        lore: [{ id: 'lamp-lore', title: 'Lamps', hidden: true, gate: 'learned:wren/lamp or died:tam and set:lamps-out@the-fen and stage of wren >= 2' }],
        powers: [{ id: 'guild', name: 'Guild', start: 1, holds: ['Fenhold'] }],
        scores: [{ id: 'dread', name: 'Dread', range: [-100, 100], start: 0 }],
        conditions: [{ name: 'lamps-out', scope: 'region' }],
        worldEvents: [
            { id: 'flood', kind: 'one-off', where: ['fenhold', 'fen-realm', 'the-fen'], requires: ['lamps-out@the-fen', 'power:guild >= 5', 'fact:lit + 2 days'], requires_any: ['learned:lore/lamp-lore'],
                window: { after: 'fired:flood + 3 days', within: '10 days' }, likelier_if: { 'score:dread >= 3': '×2', 'set:lamps-out@fenhold': '×3' }, pre_empted_by: ['died:tam'], ends_when: { any_of: ['ended:flood', 'cleared:lamps-out@reedmoor'] },
                outcomes: [{ name: 'a', weight: '100 - power:guild + standing:dread', effects: { set: ['lamps-out@fenhold: 5 days'], powers: { guild: -2 }, scores: { dread: 3 }, facts: [{ id: 'lit', text: 'Lit.' }], cast: [{ who: 'wren', location: 'reedmoor', from: 'anywhere', until: 'cleared:lamps-out@the-fen' }] } }],
                effects: { clear: ['lamps-out@the-fen'], on_end: { set: ['lamps-out@reedmoor'] } } },
            { id: 'next', kind: 'chain-stage', where: { region: 'the-fen', realm: 'fen-realm', kinds: ['town'] }, requires: ['stage:flood', 'arc-ended:thaw@Old Causeway'] },
        ],
        templates: [{ template: 'thaw', scope: 'region', needs: ['lamps-out@place'], less_if: { 'lamps-out@region': '×0.5' }, sets: ['lamps-out@place: 3 days'], clears: ['lamps-out@region'],
            fallback: { sets: ['lamps-out@place: 1 day'] }, open: { menu: { powers: { of: ['guild'], delta: [-1, 1] }, set: { of: ['lamps-out'], at: '@place', for: '5 days' }, cast: { of: ['wren', 'tam'], move: 'Fenhold' } }, writes_facts: ['thawed'] } }],
        start: { world: { set: ['lamps-out@the-fen: 1 season'], facts: ['lit'] }, place: 'fenhold' },
    },
});
