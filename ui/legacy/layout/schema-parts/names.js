// Name patterns for queries, commands and widgets.

// Names: queries and commands are dotted (`inventory.items`), widgets may be too
// (`example-module.actor-card`).
export const QUERY_NAME = /^[A-Za-z][\w-]*(\.[\w-]+)*$/;
export const COMMAND_NAME = /^[A-Za-z][\w-]*(\.[\w-]+)+$/;
export const WIDGET_NAME = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/;
