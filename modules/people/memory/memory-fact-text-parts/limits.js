// The closed list of fact kinds and the length limits of a response sentence and of a literal slot.
export const FACT_KINDS = Object.freeze(['met', 'milestone', 'move', 'gift', 'lieCaught', 'quest', 'fight', 'party']);
export const MAX_SENTENCE = 200;       // Unicode code points of one response sentence
export const MAX_LITERAL = 80;         // a name, title or label placed in a sentence
