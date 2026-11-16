// The attack-word pattern and the reader's weapon words.

export const ATTACK = /\b(?:attack(?:s|ed|ing)?|strik(?:e|es|ing)|struck|stab(?:s|bed|bing)?|slash(?:es|ed|ing)?|swing(?:s|ing)?|swung|hit(?:s|ting)?|punch(?:es|ed|ing)?|kick(?:s|ed|ing)?|shoot(?:s|ing)?|shot|fight(?:s|ing)?|fought|battl(?:e|es|ing)|ambush(?:es|ed|ing)?|kill(?:s|ed|ing)?|slay(?:s|ing)?|slit(?:s|ting)?|grappl(?:e|es|ing)|tackl(?:e|es|ing)|lunge(?:s|d)?|thrust(?:s|ing)?|cut(?:s|ting)?|slic(?:e|es|ing)|cleav(?:e|es|ing)|hack(?:s|ed|ing)?|fire(?:s|d|ing)?|engag(?:e|es|ed|ing)|assault(?:s|ed|ing)?|charg(?:e|es|ed|ing)|pounc(?:e|es|ed|ing)|jump(?:s|ed|ing)?|leap(?:s|ed|ing)?|leapt|fall(?:s|ing)?\s+upon|fell\s+upon)\b/iu;

// The reader's weapons, in one place: a phrasal attack moves one of these, and only one of these counts as the reader's own "my ...".
export const WEAPON = new Set(['cane', 'ferrule', 'blade', 'sword', 'knife', 'dagger', 'spear', 'axe', 'hammer', 'mace', 'club', 'staff', 'cudgel', 'pick', 'stick', 'bow', 'weapon']);
