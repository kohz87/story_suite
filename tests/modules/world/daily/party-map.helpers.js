// The small map of the party-near tests.
// west – mid – far in a line; `isle` has no route. "West / Docks" is a district of West.
export const MAP = {
    regions: [{ id: 'west', name: 'The Westlands', aliases: ['the west'] }, { id: 'mid', name: 'Midlands' }, { id: 'far', name: 'Far Coast' }, { id: 'isle', name: 'The Isle' }],
    realms: [{ name: 'Old Realm', regions: ['west'] }],
    places: [
        { id: 'westport', name: 'Westport', region: 'west', kind: 'town' }, { name: 'Westport / Docks', region: 'west', kind: 'site' },
        { id: 'midford', name: 'Midford', region: 'mid', kind: 'town' }, { id: 'midmoor', name: 'Midmoor', region: 'mid', kind: 'village' },
        { id: 'farhaven', name: 'Farhaven', region: 'far', kind: 'town' }, { id: 'islet', name: 'Islet', region: 'isle', kind: 'village' },
    ],
    routes: [{ from: 'Westport / Docks', to: 'midford' }, { from: 'Midford', to: 'Midmoor' }, { name: 'coast road', from: 'Midmoor', to: 'Farhaven' }, { from: 'Islet', to: 'Nowhere' }],
    conditions: [{ name: 'unrest', scope: 'place', fades: '10 days' }],
};
