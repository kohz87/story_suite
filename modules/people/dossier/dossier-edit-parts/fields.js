// The editor's own controls for dossier fields, what each shows, and which the reader left untouched.

// The editor's own controls for dossier fields: element id (after people_edit_), the label the
// reader sees, and for a text the most the stored record keeps (normalizeNpcRecord; for a lockable
// text the locked maximum, since an unlocked one is compacted further). A null maximum is a select or
// a one-per-line list, whose line count the Save caps instead. `pairs`: each line is "Name — description" (an entry of { name, description }).
// `when: 'rpg'`: the control is drawn only while the RPG feature is on; with it off the stored value is kept as it is (untouchedEditorFields).
export const EDITOR_FIELDS = Object.freeze({
    name: { id: 'name', label: 'Name', max: 120 },
    species: { id: 'species', label: 'Species', max: 160 },
    gender: { id: 'gender', label: 'Gender', max: null },
    role: { id: 'role', label: 'Role', max: 300 },
    aliases: { id: 'aliases', label: 'Aliases', max: null, list: true },
    homeBase: { id: 'home_base', label: 'Home Base', max: 300 },
    age: { id: 'age', label: 'Age', max: 80 },
    apparentAge: { id: 'apparent_age', label: 'Apparent age', max: 80 },
    personality: { id: 'personality', label: 'Personality', max: 900 },
    behaviorProfile: { id: 'behavior_profile', label: 'Behavioral Levers', max: null, list: true },
    speech: { id: 'speech', label: 'Speech', max: 600 },
    background: { id: 'background', label: 'Background', max: 1200 },
    mannerisms: { id: 'mannerisms', label: 'Mannerisms', max: null, list: true },
    keyRelationships: { id: 'key_relationships', label: 'Key relationships', max: null, list: true },
    relationshipSummary: { id: 'relationship_summary', label: 'Player Dynamic', max: 320 },
    mood: { id: 'mood', label: 'Mood', max: 300 },
    location: { id: 'location', label: 'Location', max: 300 },
    goal: { id: 'goal', label: 'Goal', max: 500 },
    status: { id: 'status', label: 'Condition / Activity', max: 500 },
    memories: { id: 'memories', label: 'Important memories', max: null, list: true },
    level: { id: 'level', label: 'Level', max: null, when: 'rpg' },
    abilities: { id: 'abilities', label: 'Abilities', max: null, list: true, pairs: true },
    keepsakes: { id: 'keepsakes', label: 'Keepsakes', max: null, list: true, pairs: true },
});

// A pair entry as the editor's line: "Name — description" (the name alone when it has no description).
const pairLine = entry => (entry?.description ? `${entry.name} — ${entry.description}` : String(entry?.name ?? ''));

// The text the editor shows for a field of this record.
export function editorShownValue(npc, key) {
    const field = EDITOR_FIELDS[key];
    if (field?.pairs) return (Array.isArray(npc?.[key]) ? npc[key] : []).map(pairLine).join('\n');
    return field?.list ? (Array.isArray(npc?.[key]) ? npc[key] : []).join('\n') : String(npc?.[key] ?? '');
}

// Fields whose control still holds exactly what the editor showed for the record (readControl(id)
// returns a control's raw value). A Save keeps these as they are stored, never re-cut or compacted.
// `rpgOn` false: a control drawn only with RPG on is not there, so its stored value is kept.
export function untouchedEditorFields(current, readControl, { rpgOn = true } = {}) {
    const untouched = new Set();
    for (const [key, field] of Object.entries(EDITOR_FIELDS)) {
        if (field.when === 'rpg' && !rpgOn) { untouched.add(key); continue; }
        if (String(readControl(`people_edit_${field.id}`) ?? '') === editorShownValue(current, key)) untouched.add(key);
    }
    return untouched;
}
