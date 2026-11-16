// Whether an NPC's memories are manually locked, shared by handle selection and phrasing.

export const locked = npc => (Array.isArray(npc?.manualProfileFields) ? npc.manualProfileFields : []).includes('memories');
