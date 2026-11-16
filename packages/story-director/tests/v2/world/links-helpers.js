// Test stand-ins for the world links tests: NPC State Delta with faction dossiers, and the reply lines that write the data.

export const DOSSIERS = { Mira: { faction: 'Guild' }, Brecht: { customFields: { affiliation: 'the guild, Chapel' } }, Wynn: { faction: 'Chapel' } };
export const delta = () => ({
    id: 'npc-state-delta', name: 'NPC State Delta (test stand-in)', version: '0.0.0-test', domains: {}, commands: {},
    queries: {
        'npc.known': () => Object.keys(DOSSIERS),
        'npc.dossier': (_state, { name } = {}) => (DOSSIERS[name] ? { name, ...DOSSIERS[name] } : null),
        'npc.meters': () => null,
    },
});

export const LINES = [
    '~ time June 3, 1200, 08:00 am', '~ place Harbour', '+ present Mira',
    '+ world Red Plague — coughing in the docks | state: ongoing | place: Harbour | factions: Guild',
    '+ faction Guild — the harbour guild | area: Harbour | stance: wary',
    '+ quest Rat Cellar — clear the cellar | goal: kill 3 rats | place: Harbour — Cellar',
    '+ quest Far Errand — a letter | goal: deliver it | place: Nowhereville',
    '+ event Harvest Fair — the fair comes to town | on: June 10, 1200',
];
