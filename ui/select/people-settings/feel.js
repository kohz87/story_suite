// The People page's first groups from mock v7: Feelings, Pacing, Stages, Pull and drift and Who gets a dossier, each row tied to its NPC State setting.
import { normalizeRelationshipBaseline, normalizeRelationshipCaps, normalizeCustomFieldNames } from '../../../modules/people/core/core.js';
import { DEFAULT_RELATIONSHIP, DEFAULT_RELATIONSHIP_CAPS } from '../../../modules/people/core/core.js';
import { normalizeAllowance, DEFAULT_ALLOWANCE } from '../../../modules/people/legacy/relationship-pacing.js';
import { intRow, schemaRow, segRow } from './kit.js';
import { multiRow, shownRow, clamp } from './kit-more.js';

const FEEL = ['Trust', 'Affection', 'Desire', 'Tension'];
const TIERS = ['Ordinary', 'Meaningful', 'Major', 'Extreme'];
const NOT_YET = 'set in the old view for now';
const caps = clamp(0, Infinity, 0);

/** The custom-field names as the box shows them: the configured list only; Level joins it by itself while RPG is on. */
const fieldsRow = {
  group: 'Who gets a dossier', key: 'people.customFields', type: 'txt', label: 'Custom fields', unit: null, tags: [], wide: true, options: null, store: 'customFieldNames', dflt: [], reset: [['customFieldNames', []]],
  hint: 'Up to 6 names, comma-separated, kept on every dossier. Level is added by itself while the RPG is on.',
  read: b => (Array.isArray(b.customFieldNames) ? b.customFieldNames : []).join(', '),
  write: v => [['customFieldNames', normalizeCustomFieldNames(v)]],
};

/** Returns the rows of the first five People groups. */
export function feelRows() {
  return [
    shownRow('Feelings', 'meters', 'The four feelings', 'fixed', { hint: 'Trust, Affection, Desire, Tension · −100 to +100, 0 means neutral' }),
    shownRow('Feelings', 'customMeters', 'Custom meters', NOT_YET, { hint: 'Add your own (Fear, Respect, Debt…), up to 6' }),
    shownRow('Feelings', 'presets', 'Meter presets (up to 12)', NOT_YET, { hint: 'Companion, Rival, Mentor and pack sets; none are on until you pick them' }),
    multiRow('Feelings', 'startingValues', 'Starting values', 'relationshipBaseline', FEEL, { hint: 'Trust, Affection, Desire, Tension for new people', cut: clamp(-100, 100, 0), clean: normalizeRelationshipBaseline, dflt: DEFAULT_RELATIONSHIP }),
    shownRow('Feelings', 'perMeterStages', 'Per-meter stages', NOT_YET, { hint: 'Named thresholds on one meter (separate from the ladder)' }),
    multiRow('Pacing', 'tierCaps', 'How far one moment moves a feeling', 'relationshipCaps', TIERS, { hint: 'Each change line is rated by how much the moment matters; a deep value resists more', cut: caps, clean: normalizeRelationshipCaps, dflt: DEFAULT_RELATIONSHIP_CAPS }),
    multiRow('Pacing', 'daily', 'Moments per story day, per person', 'relationshipAllowance', TIERS, { hint: 'Over the allowance a moment counts as the tier below; blank is no limit', cut: v => Number(v), clean: normalizeAllowance, blank: null, dflt: DEFAULT_ALLOWANCE }),
    schemaRow('Pacing', 'ceiling', 'Safety ceiling per reply', 'changeCap', 15, { hint: 'The most one feeling moves in one reply, all lines together; rarely reached' }),
    shownRow('Stages', 'stageLadder', 'Stage ladder', NOT_YET, { hint: 'The named rungs and what each needs' }),
    schemaRow('Stages', 'repliesBeforeAStageIsLos', 'Replies before a stage is lost', 'demoteAfter', 3, { hint: 'After a sustained low', unit: 'replies' }),
    schemaRow('Pull and drift', 'repeatedApproachesWindow', 'Repeated approaches: window', 'gateDays', 3, { unit: 'story days' }),
    segRow('Pull and drift', 'repeatedApproachesStreng', 'Repeated approaches: strength', 'gateStrength', 'normal', [['Light', 'light'], ['Normal', 'normal'], ['Strong', 'strong']]),
    schemaRow('Pull and drift', 'stagesHoldWhileTensionIs', 'Stages hold while tension is above', 'conflictAt', 50),
    segRow('Who gets a dossier', 'dossier', 'Who gets a dossier', 'admissionMode', 'conservative', [['Conservative', 'conservative'], ['Balanced', 'balanced'], ['Manual only', 'manual_only']], { hint: 'Conservative: proper names at once, role labels after they recur. Balanced: also direct or lasting role people. Manual only: every dossier needs + Add' }),
    intRow('Who gets a dossier', 'dormant', 'Dormant after', 'staleArchiveAfter', 30, { min: 10, max: 999, unit: 'replies unseen', tags: ['merged:archive'], hint: 'Hidden from the list until seen again (never deleted); search still finds them. Followed people and party members never go dormant' }),
    shownRow('Who gets a dossier', 'theDead', 'The dead', 'always', { hint: 'Kept read-only under Deceased' }),
    fieldsRow,
  ];
}
