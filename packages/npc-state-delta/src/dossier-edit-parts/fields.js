// The editor's own controls for dossier fields, what each shows, and which the reader left untouched.

// The editor's own controls for dossier fields: element id (after npc_state_delta_edit_), the label the
// reader sees, and for a text the most the stored record keeps (normalizeNpcRecord; for a lockable
// text the locked maximum, since an unlocked one is compacted further). A null maximum is a select or
// a one-per-line list, whose line count the Save caps instead.
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
});

// The text the editor shows for a field of this record.
export function editorShownValue(npc, key) {
    return EDITOR_FIELDS[key]?.list ? (Array.isArray(npc?.[key]) ? npc[key] : []).join('\n') : String(npc?.[key] ?? '');
}

// Fields whose control still holds exactly what the editor showed for the record (readControl(id)
// returns a control's raw value). A Save keeps these as they are stored, never re-cut or compacted.
export function untouchedEditorFields(current, readControl) {
    const untouched = new Set();
    for (const [key, field] of Object.entries(EDITOR_FIELDS)) {
        if (String(readControl(`npc_state_delta_edit_${field.id}`) ?? '') === editorShownValue(current, key)) untouched.add(key);
    }
    return untouched;
}
