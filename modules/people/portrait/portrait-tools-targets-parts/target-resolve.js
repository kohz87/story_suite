/* NPC State Delta portrait target resolution: which forms an NPC has and which portrait a form shows. */
import { api } from '../../legacy/dossier-tools-core.js';
import { portraitSrc } from '../portrait-file.js';

export function npcForms(npc) {
    return (Array.isArray(npc?.appearanceForms) ? npc.appearanceForms : []).map(form => String(form?.name || '').trim()).filter(Boolean);
}

export function targetPortrait(npc, form = '') {
    if (!form) return portraitSrc(npc?.portrait);
    return api()?.formPortraits?.(npc.id)?.[form]?.dataUrl || '';
}
