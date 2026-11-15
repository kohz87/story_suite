// The small type constructors shared by the expression type parts.
export const BAD = Object.freeze({ type: 'invalid' });
export const bool = () => ({ type: 'bool' });
export const str = values => ({ type: 'enum', values });
export const int = (min, max) => ({ type: 'int', min, max });
