// Draws an entries field (a list of records read through the block's roles) as cards, bars or fields rows.
import { h, humanize } from '../../view/widgets/dom.js';
import { dmObject, dmOwn } from '../../data-modules/schema.js';
import { V } from './shared-chrome.js';
import { barNode } from './shared-bar.js';
import { drawCards, statusTone } from './cards.js';

// ---- entries (a list of records the block keeps in one field) -------------------------------------------------------------------------

const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
const isNum = sub => sub?.type === 'int' || sub?.type === 'number';
const subLabel = (sub, key) => sub?.label ?? sub?.name ?? cap(humanize(key));
const subText = value => (value === undefined || value === null ? '' : String(value));

/** Whether this field is the entries field the block's roles read. */
export function entriesRoles(definition, field) {
    const roles = definition?.roles;
    const schema = definition?.state?.[field];
    if (!dmObject(roles) || roles.field !== field || !dmObject(schema?.of) || !['cards', 'bars', 'fields'].includes(definition.layout)) return null;
    return roles;
}

export function drawEntries(env, parent, { definition, module, field, list }) {
    const schema = definition.state[field], roles = entriesRoles(definition, field);
    const rows = (Array.isArray(list) ? list : []).filter(dmObject);
    const of = schema.of;
    const statusKey = roles.status && dmOwn(of, roles.status) ? roles.status : null;
    const statusValues = statusKey ? of[statusKey].values ?? of[statusKey].options ?? [] : [];
    const layout = definition.layout;
    if (layout === 'cards') {
        const used = new Set([roles.title, roles.status, roles.step].filter(Boolean));
        const textKey = roles.text && dmOwn(of, roles.text) ? roles.text : Object.keys(of).find(key => !used.has(key) && of[key].type === 'text') ?? null;
        const items = rows.map((row, at) => {
            const value = statusKey ? row[statusKey] : null;
            const tone = statusKey ? statusTone(definition, statusValues.map(item => (dmObject(item) ? item.value : item)), value) : 'active';
            return { id: String(at), title: subText(row[roles.title]) || `#${at + 1}`, text: textKey ? subText(row[textKey]) : '', step: roles.step ? subText(row[roles.step]) : '',
                tone, statusLabel: statusKey ? subText(value) : '', edit: null };
        });
        return drawCards(env, parent, items, { key: `${module}:${field}` });
    }
    const box = h(env.doc, 'ul', 'ss-b-entries'); parent.appendChild(box);
    for (const [at, row] of rows.entries()) {
        const li = h(env.doc, 'li', layout === 'bars' ? 'ss-b-row' : 'ss-b-rec'); box.appendChild(li);
        li.setAttribute('data-entry', String(at));
        li.appendChild(h(env.doc, layout === 'bars' ? 'span' : 'b', layout === 'bars' ? 'ss-b-name' : 'ss-b-rec-title', subText(row[roles.title]) || `#${at + 1}`));
        if (layout === 'bars') {
            const numberKey = (statusKey && isNum(of[statusKey]) ? statusKey : Object.keys(of).find(key => isNum(of[key]))) ?? null;
            if (numberKey) {
                const value = Number(row[numberKey]) || 0, def = of[numberKey], min = Number(def.min ?? 0), max = Number(def.max ?? 100);
                li.appendChild(h(env.doc, 'span', 'ss-b-val', String(value)));
                li.appendChild(barNode(env.doc, value, min, max));
            }
        } else {
            const dl = h(env.doc, 'dl', 'ss-b-lines'); li.appendChild(dl);
            for (const key of Object.keys(of)) {
                if (key === roles.title) continue;
                const line = h(env.doc, 'div', 'ss-b-line'); dl.appendChild(line);
                line.appendChild(h(env.doc, 'dt', '', subLabel(of[key], key)));
                line.appendChild(h(env.doc, 'dd', '', subText(row[key])));
            }
        }
    }
    if (!rows.length) box.appendChild(h(env.doc, 'li', 'ss-b-none', V.nothing));
    return box;
}
