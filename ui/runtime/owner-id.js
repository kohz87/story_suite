// The inventory's name for a party member: the main character's things belong to `party`, every other member to their own id.

/** `party` for the main character (`pcId`), else the member's id. */
export const ownerOf = (id, pcId) => (pcId && id === pcId ? 'party' : id);
