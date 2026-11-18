// The Tools page's Prompts rows: each prompt People and the arc planner send, as stored (or the built-in text), from the settings the engine reads.
import { DEFAULT_BEHAVIOR_CRITERIA, DEFAULT_IMPACT_CRITERIA, DEFAULT_MEMORY_CRITERIA, DEFAULT_RELATIONSHIP_CRITERIA } from '../../modules/people/core/core-prompts-criteria.js';
import { DEFAULT_PLANNER_PROMPT } from '../../modules/arc/plan/prompt.js';
import { PROMPT_MAX } from '../../modules/arc/settings-parts/schema.js';

const PEOPLE = 'npc-state-delta';
const DIRECTOR = 'story-director';
// People keeps the text it is given (an empty box means the built-in rubric); the planner keeps '' for its default, as its old editor did.
const PEOPLE_MAX = 20000;

/**
 * Each prompt: `id` (the row), `module` and `field` (the stored setting the engine reads), `fallback` (the built-in text), `blank` (what is stored for
 * the default: the text itself for People, '' for the planner), `max` (longest text kept), `label` and `hint` (the reader's words, NSD-WORDING SATOOLS).
 */
export const PROMPTS = Object.freeze([
  { id: 'feelings', module: PEOPLE, field: 'relationshipCriteria', fallback: DEFAULT_RELATIONSHIP_CRITERIA, blank: DEFAULT_RELATIONSHIP_CRITERIA, max: PEOPLE_MAX,
    label: 'People: how feelings are judged', hint: 'What counts as Trust, Affection, Desire and Tension when People reads the story itself' },
  { id: 'moments', module: PEOPLE, field: 'relationshipImpactCriteria', fallback: DEFAULT_IMPACT_CRITERIA, blank: DEFAULT_IMPACT_CRITERIA, max: PEOPLE_MAX,
    label: 'People: how big a moment is', hint: 'What counts as ordinary, meaningful, major or extreme; the limits in People still apply' },
  { id: 'memories', module: PEOPLE, field: 'memoryCriteria', fallback: DEFAULT_MEMORY_CRITERIA, blank: DEFAULT_MEMORY_CRITERIA, max: PEOPLE_MAX,
    label: 'People: what is worth remembering', hint: 'What a person keeps as a memory when People reads the story, Refresh included' },
  { id: 'behaviour', module: PEOPLE, field: 'behaviorCriteria', fallback: DEFAULT_BEHAVIOR_CRITERIA, blank: DEFAULT_BEHAVIOR_CRITERIA, max: PEOPLE_MAX,
    label: 'People: feelings into behaviour', hint: 'How feelings show in what people do, in the people notes sent with each reply' },
  { id: 'arc', module: DIRECTOR, field: 'arc.prompt', fallback: DEFAULT_PLANNER_PROMPT, blank: '', max: PROMPT_MAX,
    label: 'Arc planner prompt', hint: 'What the planner is asked when it plans an arc. Macros: {{genre}}, {{now}}, {{place}}, {{note}}, {{previous_arc}}, {{tracker}}, {{recent}}, {{fights}}, {{user}}, {{char}}' },
]);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The text a prompt sends now: the stored text, or the built-in one when nothing is stored (the planner: '' or only spaces is its default). */
export function promptText(spec, values) {
  const stored = isObj(values) ? values[spec.field] : undefined;
  if (typeof stored !== 'string') return spec.fallback;
  if (spec.blank === '' && !stored.trim()) return spec.fallback;
  return stored;
}

/** `values`: { [module id]: that module's stored settings }. → { rows: [{ id, key, label, hint, text, own, max }] }; `own` = the text is not the built-in one, `max` = the longest text kept. */
export function selectPrompts(values) {
  const of = id => (isObj(values) && isObj(values[id]) ? values[id] : {});
  return {
    rows: PROMPTS.map(spec => {
      const text = promptText(spec, of(spec.module));
      return { id: spec.id, key: `tools.prompt.${spec.id}`, label: spec.label, hint: spec.hint, text, own: text !== spec.fallback, max: spec.max };
    }),
  };
}
