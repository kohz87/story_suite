// The stat formulas and number keys a pack may set for the RPG.

// A pack may also say which stat formula its story plays on and the numbers of it (`content.rpg.formula`: 'standard' only, Classic rules are gone and a pack that asks for them is refused; `content.rpg.numbers`:
// whole numbers by name, the names of src/v2/lean-rpg/rules.js STANDARD_RULE_KEYS, kept apart so packs need nothing of it). They are
// kept as one more record of the list, `{ id, slug: 'formula', pack, formula?, numbers? }`, which the skill-set readers pass over.
export const RPG_FORMULAS = Object.freeze(['standard']);
export const RPG_NUMBER_KEYS = Object.freeze(['foeBase', 'foeClassWeight', 'classWeight', 'costMargin', 'decisiveMargin', 'roundCap', 'quickStartMargin',
    'startStat', 'createPoints', 'createMin', 'createMax', 'pointsPerSoul', 'statMax']);
