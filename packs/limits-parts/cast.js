// Field names and limits of a pack's cast entries, their starts and secrets.

// The cast (`content.cast`): a hand-written list of people who live off-screen until the party meets them (Story Director)
// and get a prepared dossier at the first meeting (NPC State Delta). One entry:
// `{ id, name, aliases?, about, look (the body), wears? (clothes, armour, gear on them), voice?, personality?, behaviour? (up to 6 "Lever: level - effect"), mannerisms? (up to 4), withYou?, history?, portrait?, start: { place, goal, routine? }, drawnTo?,
// meters?: { preset?, <meter>: n }, stages?, fields?, secrets?, canDieUnmet? }`. All text is plain: no < > { } (and no | in
// the short lines a change line may carry), line breaks become spaces. `stages` take the shape of a meter preset's stages.
export const CAST_FIELDS = Object.freeze(['id', 'name', 'aliases', 'about', 'look', 'wears', 'voice', 'personality', 'behaviour', 'mannerisms', 'withYou', 'history', 'portrait', 'birthday', 'start', 'drawnTo', 'meters', 'stages', 'fields', 'secrets', 'canDieUnmet', 'gear', 'skills']);
export const CAST_START_FIELDS = Object.freeze(['place', 'goal', 'routine']);
export const CAST_SECRET_FIELDS = Object.freeze(['title', 'text', 'meter', 'at', 'when']);
export const CAST_LIMITS = Object.freeze({ entries: 64, name: 80, aliases: 8, about: 300, look: 600, wears: 300, voice: 300, personality: 600, behaviour: 6, behaviourEffect: 120, mannerisms: 4, mannerism: 120, withYou: 320, history: 1200, birthday: 80,
    place: 80, goal: 200, routine: 200, drawnTo: 6, phrase: 80, fields: 6, fieldName: 40, fieldValue: 60, secrets: 8, secretTitle: 60, secretText: 300, secretWhen: 120, meters: 10, gear: 6, skills: 8, skillName: 40, skillAbout: 120 });
