// Story Suite v2: the template renderer's DOM access (moved out of render.js unchanged). A DOM member is read as the element's own
// interface has it, never as a <form>'s control of that name or id would shadow it, so a template cannot stop a form drawing or
// leave it busy. Also: whether a control is disabled, and which elements a control name is prefixed on.
// Public face: re-exports its parts.
export { dom, setDom, call } from './dom-parts/access.js';
export { isDisabled, CONTROLS } from './dom-parts/controls.js';
