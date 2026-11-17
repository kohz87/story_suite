// Builds the Packs part over injected settings, lorebook, capability and portrait access.

import { createInstalled } from '../installed.js';
import { createPortraits } from '../portraits.js';
import { calendarOf, contentOf, craftsOf, economyOf, itemDefsIn, mergeStart, resolveItemIn, weatherOf, ripplesOf, rippleChoice, youRankOf } from '../content.js';
import { renderPacksPanel } from '../panel.js';
import { HOST_VERSION } from '../validate/core.js';
import { marketEntries } from '../lorebook.js';
import { castGearOf, gearLine } from '../cast-gear.js';
import { readSheet, sameWho } from '../../modules/rpg/read.js';
import { marketsOf } from './markets.js';

/**
 * Builds the part over injected access, so tests (and the coordinator, if it prefers the
 * registry's own capability list) can bind it to anything.
 *
 * `settings`: `{ read(), save() }` over the storySuite settings object; `readLorebook()`:
 * `→ { character, entries, problem }`; `capabilities()`: names or null; `hostVersion`: a version or a function giving it;
 * `portraitFiles`: the file store for portraits (portraits.js) and `portraitIo`: the decoder and encoder that makes a large one smaller.
 * Returns `{ part, packs, resolveItem, startState, economy }`.
 */
export function createPacksPart({ settings, readLorebook = async () => ({ character: '', entries: [], problem: 'No lorebook reader.' }), capabilities = () => null, hostVersion = HOST_VERSION, portraitFiles = null, portraitIo = null } = {}) {
    const portraits = createPortraits({ settings, files: portraitFiles, imageIo: portraitIo });
    const packs = createInstalled({ settings, capabilities, hostVersion, portraits });

    /** The pack item def a story name means, or null (see content.js resolveItemIn). */
    const resolveItem = name => resolveItemIn(packs.packs(), name);
    /** The enabled packs' start, merged (see content.js mergeStart). */
    const startState = () => mergeStart(packs.packs());
    /** The enabled packs' money scale, or null (see content.js economyOf). */
    const economy = () => economyOf(packs.packs());

    // The character lorebook's market lines, read when a chat opens and from the Packs panel.
    const lore = { markets: [], character: '', problem: '' };
    let reading = null;
    let asked = false;   // asked again while a read was on its way: that read may be of the chat before
    /** Reads the open character's lorebook again for its `market:` lines; resolves to how many places it gave. */
    const refreshLore = () => {
        if (reading) asked = true;
        reading ??= (async () => {
            try {
                // A read that ended after another chat asked is dropped and the lorebook read again: the answer is for the one open now.
                do {
                    asked = false;
                    let next = null;
                    try {
                        const got = await readLorebook();
                        next = { markets: marketEntries(got?.entries), character: String(got?.character ?? ''), problem: String(got?.problem ?? '') };
                    } catch (error) {
                        next = { markets: [], character: lore.character, problem: `The lorebook could not be read: ${error?.message ?? error}` };
                    }
                    if (asked) continue;
                    Object.assign(lore, next);
                } while (asked);
            } finally {
                reading = null;
            }
            return lore.markets.length;
        })();
        return reading;
    };
    /** What sets a place's prices: { types, tags, places } (see packs.markets above). */
    const markets = () => marketsOf(packs.packs(), lore.markets);

    const part = {
        domains: {},
        commands: {},
        queries: {
            'packs.list': () => packs.list(),
            'packs.content': (_state, { kind, pack = null } = {}) => contentOf(packs.packs(), kind, { pack }),
            'packs.item': (_state, { name } = {}) => resolveItem(name),
            // The enabled packs' items as inventory defs by definition ID, ID-sorted (content.js itemDefsIn): what a
            // rules module freezes with inventory.registerDefinition. `ids` narrows to those IDs.
            'packs.itemDefs': (_state, args) => itemDefsIn(packs.packs(), args && typeof args === 'object' && Array.isArray(args.ids) ? args.ids : null),
            'packs.start': () => startState(),
            'packs.calendar': () => calendarOf(packs.packs()),
            'packs.weather': () => weatherOf(packs.packs()),
            // The first enabled pack's ripples table `{ pack, powers, … }`, or null (Story Director's hidden sway per power).
            'packs.ripples': (_state, args) => ripplesOf(packs.packs(), args),
            'packs.rippleChoice': (_state, args, tools) => rippleChoice(packs.packs(), args, tools),
            // The Rank the first enabled pack that declares one gives {{user}}'s look, `{ pack, label }`, or null (no Rank in this story).
            'packs.youRank': () => youRankOf(packs.packs()),
            'packs.crafts': () => craftsOf(),
            'packs.economy': () => economy(),
            'packs.markets': () => markets(),
            // The URL of a cast portrait (see above): a file name the installed pack names and has a stored picture for, else null.
            'packs.portrait': (_state, { pack, file } = {}) => portraits.url(pack, file),
            // `{ name }` → `{ name, line: 'Gear: Cane Sword, Oak Buckler', items: [{ id, name, slot }] }`: a cast member's signature gear (cast.js `gear`) for the
            // narrator's cast entry, or null: no such person, no gear, they are in the party now (by their name, first name or an alias: sameWho), or gear is off (`story-block.gear` and the RPG).
            'packs.castGear': (state, { name } = {}, tools) => {
                let on = false;
                try { on = tools?.query?.('inventory.gear', { owner: 'party' })?.on === true; } catch { on = false; }
                if (!on) return null;
                const found = castGearOf(packs.packs(), name);
                if (!found?.items.length) return null;
                // (the sheet holds the Characters in the party now: one who left is not on it; read.js is the RPG's small shared reader, the rest stays lazy)
                const party = readSheet(state).characters;
                if (party.some(person => sameWho(person, found.name, found.aliases, party))) return null;
                return { name: found.name, line: gearLine(found.items), items: found.items };
            },
        },
        kinds: {},
        context: { static: () => '', tail: () => ({ lines: [], optional: [] }), budget: 0 },
        hooks: {
            'item.resolve': name => resolveItem(name),
            start: () => startState(),
        },
        settings: {
            section: 'Packs',
            // Its own fold in the settings, right after Story Suite's (host-ui.js), shown with no pack installed too.
            fold: { id: 'packs', hint: 'import a pack' },
            defaults: {},
            schema: {},
            render: (el, api) => renderPacksPanel(el, { packs, readLorebook, notify: text => api?.notify?.(text), lore: { read: refreshLore, count: () => lore.markets.length } }),
        },
        tabs: [],
    };
    return { part, packs, portraits, resolveItem, startState, economy, refreshLore, markets };
}
