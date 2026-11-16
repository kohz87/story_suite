import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dossierUiSource } from './helpers/dossier-ui-source.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
export const uiSource = dossierUiSource();
export const bootstrap = fs.readFileSync(path.join(root, 'bootstrap.js'), 'utf8');

export const cast = [
  { id: 'mira', name: 'Mira', role: 'Scout', species: 'Human', homeBase: 'Northwatch Lodge', present: false, worldActive: true, location: 'North road' },
  { id: 'sora', name: 'Sora', aliases: ['Stormcrown'], role: 'Ward', species: 'Chimera', present: true, worldActive: false, mood: 'Curious', relationship: { trust: 12 } },
  { id: 'old', name: 'Old Clerk', role: 'Clerk', archived: true, archiveReason: 'stale' },
  { id: 'fallen', name: 'Fallen Guard', role: 'Guard', archived: true, archiveReason: 'deceased', lifeState: 'dead' },
];

export const rika = {
  id: 'rika', name: 'Rika', species: 'human', gender: 'female', role: 'mage', statusLabel: 'Active', mood: 'alarmed', key: { here: true },
  relationship: { trust: 11, affection: 10, desire: 6, tension: 13 }, relationshipSummary: 'Prickly but grateful.',
  lastRelationshipChange: { impact: 'meaningful', delta: { trust: 2, tension: -1 }, reason: 'shared a meal', message: 4 },
  recentRelationshipChanges: [{ impact: 'ordinary', reason: 'bickered', message: 3 }],
  keyRelationships: ['Temiwa — friend: shelters her', 'Vane — rival: old grudge', 'Guild — owes a debt: dues', 'a loose fragment'],
  memories: ['Fled by raft', 'Found by Temiwa'], background: 'Left half-dead at the gatehouse.', cast: { where: 'the docks', doing: 'mending a net', goal: 'register' },
  v2Meters: { secrets: [{ state: 'open', title: 'Her past', text: 'Winter Gate', pill: 'Opened' }, { state: 'hidden', opens: 'Opens at Trust 25', width: 44 }] },
};

export function stubNode() {
  const node = { html: '', dataset: {}, hidden: false, textContent: '', scrollTop: 0, images: [] };
  Object.defineProperty(node, 'innerHTML', { get: () => node.html, set: value => { node.html = String(value); node.images = [...node.html.matchAll(/<img class="[^"]+" (?:data-delta-portrait="\d+"|src="[^"]*")/g)].map(() => ({ dataset: {}, hasAttribute: () => false })); } });
  node.querySelector = () => null;
  node.querySelectorAll = () => [];
  node.setAttribute = () => {};
  return node;
}

export async function builtCss() {
  const [a, b, c] = await Promise.all([import('../../modules/people/legacy/dossier-ui-styles.js'), import('../../modules/people/legacy/dossier-ui-styles-board.js'), import('../../modules/people/legacy/dossier-ui-styles-sections.js')]);
  return `${dossierUiSource()}\n${a.STYLES}\n${b.BOARD_STYLES}\n${c.SECTIONS_STYLES}`;
}
