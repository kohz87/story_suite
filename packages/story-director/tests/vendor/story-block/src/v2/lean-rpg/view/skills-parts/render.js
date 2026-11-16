// The Skills view itself: its session record and the screen that draws, edits and saves a character's skills.

import { h, iconNode } from '../../../view/widgets/dom.js';
import { meter } from '../../../view/widgets/meter.js';
import { refusalText } from '../../../strings.js';
import { LEVEL, FORMULA, RANK_NAMES } from '../../names.js';
import { UTILITY_SLOTS } from '../../../skill-slots.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { skillFlags, skillKey } from '../../board/flags.js';
import { drawSkillFlags } from '../../board/skill-editor.js';
import { RANK_TONES } from './shared-ranks.js';
import { masteryOf, rollOf } from './roll.js';
import { hasTypes, isUtility, poolsOf, slotsShown } from './slots.js';

const K = RPG_STRINGS.skills;

const cap = word => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : '');

/** The record the Party tab keeps for an open Skills view (outside the DOM: the page draws a screen again on every change of the story). */
export const newSkillsSession = character => ({ module: character.module, subject: character.subject, editing: null, start: null, draft: { name: '', about: '', type: 'combat' }, busy: false, message: '' });

/**
 * Draws `character`'s skills (a readParty record) into `parent`. Options: `session` (newSkillsSession's record, kept by the caller),
 * `api` ({ command }; without one there are no pencils), `onBack()`, `rules()` (the numbers a roll is made with now: the roll line follows them), `rolled()` (the RPG is on and Rolls automatic: the footer says practice comes from rolled uses), `onSaved()` (a save ended: the page draws the view again from the session,
 * since it already drew itself once after the first write and this instance may be gone), `doc`. → { el, session, edit(slot), save(), destroy() }.
 */
export function renderSkills(parent, { character, session = null, api = {}, onBack = () => {}, onSaved = () => {}, rules = () => FORMULA, rolled = () => false, board = null, doc = parent.ownerDocument ?? globalThis.document } = {}) {
    const run = session ?? newSkillsSession(character);
    const block = character.skillsBlock;
    const root = h(doc, 'section', 'rpg-sheet rpg-skills-view ss-glass');
    root.setAttribute('aria-label', fill(K.title, { name: character.name }));
    parent.appendChild(root);
    let alive = true, handles = [], saveButton = null, noteNode = null;

    // The slot being edited changed under the editor (the story renamed it): the editor closes and says so.
    const skillAt = slot => character.skills.find(skill => skill.slot === slot) ?? null;
    if (run.editing !== null) {
        const now = skillAt(run.editing);
        if (!run.busy && (!now || now.name !== run.start?.name || now.about !== run.start?.about || (isUtility(now) ? 'utility' : 'combat') !== run.start?.type)) Object.assign(run, { editing: null, start: null, message: K.changed });
    }

    const clear = () => { for (const handle of handles) handle.destroy?.(); handles = []; root.replaceChildren(); };
    const limit = field => (Number.isSafeInteger(block?.definition?.state?.[field]?.max) ? block.definition.state[field].max : null);
    const words = () => (run.busy ? K.saving : run.message);

    function edit(slot) {
        const skill = skillAt(slot);
        if (!skill || run.busy || typeof api.command !== 'function') return;
        const explicit = board?.flags?.()?.[skillKey(character.module, skill)] ?? null;
        // (the board flags are those of a combat skill: a utility skill has none until it is switched to combat)
        const flags = board?.on?.() ? skillFlags({ ...skill, type: 'combat' }, explicit) : null, type = isUtility(skill) ? 'utility' : 'combat';
        Object.assign(run, { editing: slot, start: { name: skill.name, about: skill.about, type, ...(flags ? { flags: { ...flags } } : {}), ...(explicit ? { explicitFlags: true } : {}) }, draft: { name: skill.name, about: skill.about, type, ...(flags ? { flags: { ...flags } } : {}) }, message: '' });
        draw();
    }
    function cancel() {
        if (run.busy) return;
        Object.assign(run, { editing: null, start: null, message: '' });
        draw();
    }

    // The name and the description go as one `dm.set` with `fields`: one action, all or nothing; nothing else of the skill is sent.
    async function save() {
        const slot = run.editing;
        if (slot === null || run.busy || !alive || typeof api.command !== 'function') return { ok: false };
        const name = run.draft.name.replace(/\s+/g, ' ').trim(), about = run.draft.about.replace(/\s+/g, ' ').trim();
        if (!name) { run.message = K.needName; draw(); return { ok: false }; }
        const typeChanged = hasTypes(character) && run.draft.type !== run.start.type;
        if (typeChanged) {
            const pools = poolsOf(character);
            const full = run.draft.type === 'utility' ? pools.utility.length >= UTILITY_SLOTS : pools.combat.length >= pools.combatMax;
            if (full) { run.message = K.poolFull; draw(); return { ok: false }; }
        }
        const wordsChanged = name !== run.start.name || about !== run.start.about || typeChanged;
        const flagsChanged = run.draft.flags && run.draft.type !== 'utility' && JSON.stringify(run.draft.flags) !== JSON.stringify(run.start.flags);
        if (!wordsChanged && !flagsChanged) { cancel(); return { ok: true }; }
        run.busy = true;
        run.message = '';
        if (saveButton) saveButton.disabled = true;
        if (noteNode) noteNode.textContent = words();
        let failure = null;
        try {
            if (wordsChanged) {
                const result = await api.command('dm.set', { module: block.module, fields: { [`skill${slot}`]: name, [`about${slot}`]: about, ...(typeChanged ? { [`type${slot}`]: run.draft.type } : {}) } });
                if (!result?.ok) failure = result ?? { ok: false };
            }
            if (!failure && (flagsChanged || (name !== run.start.name && run.start.explicitFlags)) && run.draft.type !== 'utility') {
                // Board on: save the three flags. Board off: only carry the explicit entry to the new name.
                const result = run.draft.flags
                    ? await api.command('rpg.boardSkill', { module: character.module, slot, name, flags: run.draft.flags })
                    : await api.command('rpg.boardSkillCarry', { module: character.module, slot, from: run.start.name, name });
                if (!result?.ok) failure = result ?? { ok: false };
            }
        } catch (error) {
            failure = { ok: false, message: String(error?.message ?? error) };
        }
        run.busy = false;
        if (failure) run.message = refusalText(failure, K.failed);
        else Object.assign(run, { editing: null, start: null, message: '' });
        if (alive) draw();
        onSaved({ ok: !failure });
        return { ok: !failure };
    }

    function pencil(row, skill) {
        const node = h(doc, 'button', 'ss-iconbutton rpg-skill-pencil');
        node.setAttribute('type', 'button');
        node.setAttribute('aria-label', fill(K.edit, { name: skill.name }));
        node.setAttribute('title', fill(K.edit, { name: skill.name }));
        node.setAttribute('data-skill-edit', String(skill.slot));
        const glyph = iconNode(doc, 'ph-pencil-simple');
        if (glyph) node.appendChild(glyph);
        node.addEventListener('click', () => edit(skill.slot));
        row.appendChild(node);
    }

    // "Used for": Combat or Utility. A kind whose slots are all used cannot be switched to (the skill's own kind always stays); the help says what a utility skill is.
    function usedFor(form, skill) {
        const pools = poolsOf(character), wrap = h(doc, 'div', 'rpg-skill-field rpg-skill-usedfor');
        wrap.appendChild(h(doc, 'span', 'rpg-skill-field-label', K.usedFor));
        const seg = h(doc, 'span', 'rpg-skill-seg');
        seg.setAttribute('role', 'group');
        seg.setAttribute('aria-label', K.usedFor);
        for (const kind of ['combat', 'utility']) {
            const own = (isUtility(skill) ? 'utility' : 'combat') === kind, full = !own && (kind === 'utility' ? pools.utility.length >= UTILITY_SLOTS : pools.combat.length >= pools.combatMax);
            const option = h(doc, 'button', `rpg-skill-seg-option${run.draft.type === kind ? ' rpg-skill-seg-on' : ''}`, kind === 'utility' ? K.typeUtility : K.typeCombat);
            option.setAttribute('type', 'button');
            option.setAttribute('data-skill-type', kind);
            option.setAttribute('aria-pressed', String(run.draft.type === kind));
            if (full) { option.disabled = true; option.setAttribute('title', K.poolFull); }
            option.addEventListener('click', () => { run.draft.type = kind; draw(); });
            seg.appendChild(option);
        }
        wrap.appendChild(seg);
        form.appendChild(wrap);
        if (run.draft.type === 'utility') form.appendChild(h(doc, 'p', 'rpg-skill-help', K.utilityHelp));
    }

    function editor(row, skill) {
        const form = h(doc, 'div', 'rpg-skill-form');
        const field = (label, node) => {
            const wrap = h(doc, 'label', 'rpg-skill-field');
            wrap.appendChild(h(doc, 'span', 'rpg-skill-field-label', label));
            wrap.appendChild(node);
            form.appendChild(wrap);
            return node;
        };
        const name = h(doc, 'input', 'rpg-skill-input');
        name.setAttribute('type', 'text');
        name.setAttribute('data-skill-field', 'name');
        name.value = run.draft.name;
        if (limit(`skill${skill.slot}`)) name.setAttribute('maxlength', String(limit(`skill${skill.slot}`)));
        const about = h(doc, 'textarea', 'rpg-skill-input');
        about.setAttribute('rows', '3');
        about.setAttribute('data-skill-field', 'about');
        about.value = run.draft.about;
        if (limit(`about${skill.slot}`)) about.setAttribute('maxlength', String(limit(`about${skill.slot}`)));
        field(K.editName, name);
        field(K.editAbout, about);
        if (hasTypes(character)) usedFor(form, skill);
        if (run.draft.flags && run.draft.type !== 'utility') drawSkillFlags(doc, form, run.draft.flags);
        name.addEventListener('input', () => { run.draft.name = name.value; });
        about.addEventListener('input', () => { run.draft.about = about.value; });
        form.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault?.(); event.stopPropagation?.(); cancel(); } });
        const actions = h(doc, 'div', 'rpg-card-actions');
        saveButton = h(doc, 'button', 'ss-button ss-button-primary rpg-skill-save', K.save);
        saveButton.setAttribute('type', 'button');
        saveButton.disabled = run.busy;
        saveButton.addEventListener('click', () => { save(); });
        const stop = h(doc, 'button', 'ss-button rpg-skill-cancel', K.cancel);
        stop.setAttribute('type', 'button');
        stop.addEventListener('click', cancel);
        actions.append(saveButton, stop);
        form.appendChild(actions);
        row.appendChild(form);
    }

    function skillRow(list, skill) {
        const roll = rollOf(skill, character, rules()), mastery = masteryOf(skill);
        const row = h(doc, 'article', `rpg-skill${isUtility(skill) ? ' rpg-skill-util' : ''}`);
        row.setAttribute('data-slot', String(skill.slot));
        const top = h(doc, 'div', 'rpg-skill-top');
        top.appendChild(h(doc, 'p', 'rpg-skill-name', skill.name));
        top.appendChild(h(doc, 'span', `ss-pill rpg-rank rpg-tone-${mastery.tone}`, skill.rankName));
        // A signature skill (a pack's cast member brought it, the Skills block's `sig`): the lock the bound gear wears, after the rank pill.
        if (skill.signature) {
            const lock = iconNode(doc, 'ph-lock-simple:fill', 'rpg-skill-lock');
            if (lock) { lock.setAttribute('title', K.signatureTitle); lock.setAttribute('aria-label', K.signatureTitle); lock.removeAttribute('aria-hidden'); lock.setAttribute('role', 'img'); top.appendChild(lock); }
        }
        const uses = skill.stat ? fill(K.usesStat, { stat: roll.stat ?? skill.stat.toUpperCase(), uses: cap(skill.uses ?? 'stamina') }) : '';
        if (uses) top.appendChild(h(doc, 'span', 'rpg-skill-uses', uses));
        if (typeof api.command === 'function' && block) pencil(top, skill);
        row.appendChild(top);
        if (run.editing === skill.slot) { editor(row, skill); list.appendChild(row); return; }
        if (skill.about) row.appendChild(h(doc, 'p', 'rpg-skill-about', skill.about));
        const bar = h(doc, 'div', 'rpg-skill-meter');
        row.appendChild(bar);
        handles.push(meter.render(bar, { label: K.mastery, value: mastery.value, max: mastery.max, segments: mastery.max, tone: mastery.tone, text: mastery.text, icon: 'fa-book-open' }, {}));
        const line = h(doc, 'p', 'rpg-skill-roll');
        const rank = { rank: skill.rankName, n: skill.rank, level: character.level, divisor: rules().levelDivisor ?? LEVEL.divisor, bonus: roll.bonus };
        if (roll.stat) {
            line.appendChild(h(doc, 'b', '', fill(K.rolls, { total: roll.total })));
            line.appendChild(doc.createTextNode(' '));
            line.appendChild(h(doc, 'span', '', fill(roll.second ? K.rollsPartsStandard : K.rollsParts, { ...rank, stat: roll.stat, value: roll.value, half: roll.half, second: roll.second, secondValue: roll.secondValue })));
        } else line.appendChild(h(doc, 'span', '', fill(K.rollsNoStat, rank)));
        row.appendChild(line);
        list.appendChild(row);
    }

    function draw() {
        if (!alive) return;
        clear();
        saveButton = null;
        const head = h(doc, 'div', 'rpg-sheet-head');
        head.appendChild(h(doc, 'h3', 'rpg-sheet-name', fill(K.title, { name: character.name })));
        const pills = h(doc, 'div', 'rpg-pills');
        pills.appendChild(h(doc, 'span', 'ss-pill rpg-level-pill', character.levelText));
        head.appendChild(pills);
        root.appendChild(head);
        const legend = h(doc, 'div', 'rpg-skill-legend');
        legend.appendChild(h(doc, 'span', '', K.legend));
        RANK_NAMES.forEach((rank, at) => legend.appendChild(h(doc, 'span', `ss-pill rpg-tone-${RANK_TONES[at]}`, fill(K.legendPill, { rank, n: at }))));
        legend.appendChild(h(doc, 'span', '', K.legendEnd));
        // (the lock is explained only where one is drawn)
        const signed = character.skills.some(skill => skill.signature);
        if (signed) {
            const key = h(doc, 'span', 'rpg-skill-legend-lock');
            const mark = iconNode(doc, 'ph-lock-simple:fill', 'rpg-skill-lock');
            if (mark) key.appendChild(mark);
            key.appendChild(doc.createTextNode(` ${K.legendSignature}`));
            legend.appendChild(key);
        }
        root.appendChild(legend);
        const list = h(doc, 'div', 'rpg-skill-list');
        root.appendChild(list);
        if (hasTypes(character)) {
            // Two lists, each with its count and one line for the slots still free; the fight board lists the combat one only.
            const pools = poolsOf(character);
            const group = (head, skills, max, one, many) => {
                const bar = h(doc, 'div', 'rpg-skill-group');
                bar.append(h(doc, 'span', '', head), h(doc, 'span', '', fill(K.countOf, { n: skills.length, max })));
                list.appendChild(bar);
                for (const skill of skills) skillRow(list, skill);
                if (max > skills.length) list.appendChild(h(doc, 'div', 'rpg-skill-empty', max - skills.length === 1 ? one : fill(many, { n: max - skills.length })));
            };
            group(K.combatHead, pools.combat, pools.combatMax, K.freeCombatOne, K.freeCombat);
            group(K.utilityHead, pools.utility, pools.utilityMax, K.freeUtilityOne, K.freeUtility);
        } else {
            for (const skill of character.skills) skillRow(list, skill);
            for (let empty = character.skills.length; empty < slotsShown(character); empty += 1) list.appendChild(h(doc, 'div', 'rpg-skill-empty', fill(K.empty, { name: character.name })));
        }
        const foot = h(doc, 'div', 'rpg-skill-foot');
        const back = h(doc, 'button', 'ss-button ss-button-primary rpg-skills-back', K.back);
        back.setAttribute('type', 'button');
        back.addEventListener('click', () => { if (!run.busy) onBack(); });
        foot.appendChild(back);
        const baseNote = rolled() ? K.noteRolled : K.note;
        foot.appendChild(h(doc, 'p', 'rpg-skill-note', signed ? `${baseNote} ${K.noteSignature}` : baseNote));
        noteNode = h(doc, 'p', 'rpg-skill-status', words());
        noteNode.setAttribute('role', 'status');
        foot.appendChild(noteNode);
        root.appendChild(foot);
    }

    draw();
    return {
        el: root,
        session: run,
        edit,
        save,
        destroy() { alive = false; clear(); root.remove(); },
    };
}
