// The job: the pinned blocks the reader switched on for Now (Story › Trackers › Show on Now), each with its fields as the block shows them, for the Now tab's cards.

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');

/** `[{ id, name, view: { chat: { label: value } } }]` from `dataModules.setup` (pinned rows whose definition has `show.card`) and `dataModules.view` (a chat-scope block's values); labels are the block's field labels. */
export function pinnedFeed(read) {
  const rows = read('dataModules.setup', {});
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isRec(row) || row.pinned !== true) continue;
    const definition = row.pinnedDefinition ?? row.definition;
    if (!isRec(definition) || definition.scope !== 'chat' || !definition.show?.card) continue;
    const view = read('dataModules.view', { module: row.module });
    if (!isRec(view?.chat)) continue;
    const chat = {};
    // (a field the block keeps for its own rules, not for the story or the reader — `prompt: false` or `edit: false`: Rise, Level cap, Down, the largest bars — is not a line on Now)
    for (const [key, value] of Object.entries(view.chat)) {
      const field = definition.state?.[key];
      if (field?.prompt === false || field?.edit === false) continue;
      chat[text(field?.label) || key] = value;
    }
    out.push({ id: text(row.module), name: text(definition.name) || text(row.module), view: { chat } });
  }
  return out;
}
