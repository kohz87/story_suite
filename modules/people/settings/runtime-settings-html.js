/* NPC State settings panel markup (role: settings-panel-html). buildSettingsHtml, the hints and open-group memory,
   and the controls' sync from the stored settings. Built by runtime-entry.js once per module instance with the shared runtime
   state and the controller functions it calls. Bodies are moved from runtime-entry.js without change. */

import { PORTRAIT_STYLE_PROMPT_LIMIT, PORTRAIT_COMPOSITION_PROMPT_LIMIT } from '../core/core.js';
import { escapeHtml } from '../util/html.js';
import { PORTRAIT_THEME_PRESETS, getSettings } from './runtime-settings.js';

export function createSettingsHtmlPart(rt, deps) {
    const { portraitSettingsSnapshot, UI_ID, updatePortraitSettingsSaveUi, writePortraitSettingsDraftToUi } = deps;

    function settingRow(id, label, control, hint = '') {
        return `<label class="ppl-setting-row story-suite-row" for="${id}"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span>${control}</label>`;
    }

    function numberControl(id, min, max, unit = '', { step = '', prefix = '' } = {}) {
        return `<span class="delta-setting-number story-suite-number">${prefix}<input id="${id}" type="number" min="${min}" max="${max}"${step ? ` step="${step}"` : ''} class="text_pole ppl-number">${unit ? `<small>${unit}</small>` : ''}</span>`;
    }

    function settingsGroup(key, title, hint, body, { hidden = false } = {}) {
        return `<details class="delta-settings-group story-suite-fold" data-delta-settings-group="${key}"${hidden ? ' hidden' : ''}><summary><b>${title}</b>${hint ? `<small>${hint}</small>` : ''}</summary><div class="delta-settings-group-body story-suite-fold-body">${body}</div></details>`;
    }

    // The Extensions-tab panel is built once here in its final grouped shape. Two controls are added by their own files once it is on the
    // page: Maximum output tokens after Scan context (scanner-output.js) and the calendar in its group (calendar-settings.js); the meter
    // presets block fills its group (adapter/cast-ui/section.js).
    function buildSettingsHtml() {
        const scanning = [
            settingRow('people_full_scan_every_turn', 'Full scan every turn', '<input id="people_full_scan_every_turn" type="checkbox">', 'With Auto scan, reconcile the whole scan context after every reply instead of only the latest exchange. Overrides Scan every; relationship deltas still come only from the newest exchange.'),
            settingRow('people_narration_capture', 'One-pass narration capture (experimental)', '<input id="people_narration_capture" type="checkbox">', 'Works on its own, with Auto scan on or off: the roleplay model ends each reply with a hidden NPC update block that replaces the separate scan request. Adds about 2,000-3,000 tokens to every roleplay prompt plus the block to each reply; a missing or broken block falls back to the normal scan. Not used with Full scan every turn.'),
            settingRow('people_narration_capture_catch_up', 'One-pass catch-up', numberControl('people_narration_capture_catch_up', 0, 50, 'replies'), 'Needs One-pass narration capture. Each person waits this many replies between Refreshes: after a reply, someone who was in the last this-many replies and has waited that long gets a quiet Refresh (one scanner request) that writes their slow fields. 0 turns it off.'),
            settingRow('people_narration_capture_catch_up_people', 'NPCs refreshed per reply', numberControl('people_narration_capture_catch_up_people', 1, 3, 'people'), 'Needs the one-pass catch-up. The most people one reply may Refresh (1 to 3). Fewer than this many may go: nobody is taken twice inside the wait.'),
            settingRow('people_scan_every', 'Scan every', numberControl('people_scan_every', 1, 20, 'replies'), 'Safety scan cadence when Full scan every turn is off. A reply that names someone new, a tracked person or an NPC State line scans at once; a quiet reply waits for this many replies, and the scan then reads every reply since the last one.'),
            settingRow('people_admission_mode', 'NPC admission', '<select id="people_admission_mode" class="text_pole"><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="manual_only">Manual only</option></select>', 'Conservative: proper names immediately, role labels after recurrence. Balanced: also direct or persistent role NPCs. Manual only: every dossier needs Add NPC.'),
        ].join('');
        const roster = `
        <h4 class="delta-settings-subhead story-suite-subhead">Generation injection</h4>
        ${settingRow('people_inject', 'Inject present NPC state', '<input id="people_inject" type="checkbox">', 'Only active NPCs present in the latest scanned scene are injected into generation.')}
        <h4 class="delta-settings-subhead story-suite-subhead">Custom fields</h4>
        ${settingRow('people_custom_fields', 'Custom fields', '<input id="people_custom_fields" class="text_pole" maxlength="260" placeholder="Level, Class, Faction">', 'Up to 6 names, comma-separated, tracked on every dossier. The scanner fills a value only when the story states it, keeps it until it is explicitly changed, and it is sent with present NPCs. Leave empty to turn off.')}
        <h4 class="delta-settings-subhead story-suite-subhead">Roster lifecycle</h4>
        ${settingRow('people_max', 'Maximum active NPCs', numberControl('people_max', 1, 100), 'Archived dossiers do not use an active slot.')}
        ${settingRow('people_archive_deaths', 'Archive confirmed deaths', '<input id="people_archive_deaths" type="checkbox">', 'Explicit current-timeline deaths archive instead of deleting. Ambiguous death language is ignored.')}
        ${settingRow('people_reactivate_archived', 'Reactivate on clear return', '<input id="people_reactivate_archived" type="checkbox">', 'Manual archives return when the NPC clearly reappears. Death archives need an explicit living return.')}
        ${settingRow('people_layered_secrets', 'Hidden notes for new people', '<input id="people_layered_secrets" type="checkbox">', 'When a scan builds a new dossier it also writes 2 to 5 layered hidden notes (light to deep; each opens at a rising meter value or on a story event), fitted to the background and fixed once written. The story is told them while the person is present, never to reveal; you see only that a note is hidden until it opens. Off: new people get none (existing notes stay).')}
        <h4 class="delta-settings-subhead story-suite-subhead">Stale cleanup</h4>
        ${settingRow('people_auto_prune_stale', 'Auto-manage stale NPCs', '<input id="people_auto_prune_stale" type="checkbox">', 'Long-absent NPCs auto-archive, then stale auto-archives are deleted later. Manual, death and protected records are kept; deleted names can be rediscovered.')}
        ${settingRow('people_stale_archive_after', 'Dormant after', numberControl('people_stale_archive_after', 10, 999, 'replies'), 'Default 30. Replies since the NPC was last present or active off-screen; after that they stop counting toward the NPC cap (nothing is deleted).')}
        ${settingRow('people_stale_delete_after', 'Auto-delete after', numberControl('people_stale_delete_after', 11, 1000, 'replies'), 'Default 50. Applies only to stale auto-archives.')}`;
        // (1.2.15) Settings most readers never touch, folded together so the everyday ones stay short.
        // UI only: every key, default and control id is the same as before.
        const advanced = [
            settingRow('people_scan_depth', 'Scan context', numberControl('people_scan_depth', 2, 30, 'messages'), 'History window for full, manual and Refresh scans. Quick automatic scans read every reply since the last scan (up to 30 messages at a time; the oldest first when more are waiting).'),
            settingRow('people_inject_limit', 'NPCs in the dossier', numberControl('people_inject_limit', 1, 12, 'NPCs'), 'At most this many present NPCs go into the live dossier each reply, the most relevant first (default 3).'),
            settingRow('people_inject_budget', 'Injection budget', numberControl('people_inject_budget', 512, 6000, 'tokens', { step: 100, prefix: '<small>~</small>' }), 'Upper limit; only what the present NPCs need is used. The default 4000 lets detailed dossiers reach the roleplay model in full. When it runs short, lower-priority fields, then lower-ranked NPCs, are trimmed first.'),
        ].join('');
        const portrait = `
        <p class="ppl-muted">Builds positive and negative prompts from the dossier for the native SillyTavern Image Generation handoff. The configured image backend (including ComfyUI) stays host-owned.</p>
        ${settingRow('people_portrait_generation_enabled', 'Enable Generate Portrait', '<input id="people_portrait_generation_enabled" type="checkbox">', 'Enables Generate Portrait in the dossier Portrait tool. Fails safely without changing the dossier if Image Generation is unavailable.')}
        <label class="ppl-rubric-label" for="people_portrait_theme_preset"><b>Theme preset</b><small>Built-ins are fixed starting points. Custom Library uses one of your saved presets.</small></label>
        <select id="people_portrait_theme_preset" class="text_pole">${Object.entries(PORTRAIT_THEME_PRESETS).map(([key, item]) => `<option value="${key}">${escapeHtml(item.label)}</option>`).join('')}</select>
        <div class="ppl-custom-preset-library">
          <label class="ppl-rubric-label" for="people_portrait_custom_preset"><b>Custom preset</b><small id="people_portrait_custom_preset_count"></small></label>
          <select id="people_portrait_custom_preset" class="text_pole"></select>
          <div class="ppl-custom-preset-actions">
            <div id="people_portrait_custom_add" class="menu_button"><i class="fa-solid fa-plus"></i> Add</div>
            <div id="people_portrait_custom_duplicate" class="menu_button"><i class="fa-solid fa-copy"></i> Duplicate</div>
            <div id="people_portrait_custom_rename" class="menu_button"><i class="fa-solid fa-pen"></i> Rename</div>
            <div id="people_portrait_custom_delete" class="menu_button redWarningBG"><i class="fa-solid fa-trash"></i> Delete</div>
          </div>
          <small class="ppl-muted">Each custom preset stores positive, negative, composition, prompt format, mood and location. Gallery saving stays global.</small>
        </div>
        <label class="ppl-rubric-label" for="people_portrait_style_positive"><b>Positive style / theme</b><small>House style keywords, e.g. anime key visual, painterly fantasy or model-specific tags.</small></label>
        <textarea id="people_portrait_style_positive" class="text_pole ppl-rubric-textarea" rows="3" maxlength="${PORTRAIT_STYLE_PROMPT_LIMIT}"></textarea>
        <label class="ppl-rubric-label" for="people_portrait_style_negative"><b>Negative prompt</b><small>Quality, anatomy, composition or style exclusions for every portrait.</small></label>
        <textarea id="people_portrait_style_negative" class="text_pole ppl-rubric-textarea" rows="3" maxlength="${PORTRAIT_STYLE_PROMPT_LIMIT}"></textarea>
        <label class="ppl-rubric-label" for="people_portrait_composition"><b>Portrait composition</b><small>Framing, kept separate from appearance so dossiers never need rewriting.</small></label>
        <textarea id="people_portrait_composition" class="text_pole ppl-rubric-textarea" rows="2" maxlength="${PORTRAIT_COMPOSITION_PROMPT_LIMIT}"></textarea>
        ${settingRow('people_portrait_prompt_format', 'Prompt format', '<select id="people_portrait_prompt_format" class="text_pole"><option value="hybrid">Structured hybrid</option><option value="tags">Comma tags</option><option value="natural">Natural language</option></select>', 'Hybrid groups dossier facts with theme tags; Tags suits SD/anime checkpoints; Natural suits natural-language models (Flux, Krea, SD3-class).')}
        ${settingRow('people_portrait_use_mood', 'Use current mood', '<input id="people_portrait_use_mood" type="checkbox">', 'Adds current mood as expression. Personality and Background never enter the image prompt.')}
        ${settingRow('people_portrait_use_location', 'Use current location', '<input id="people_portrait_use_location" type="checkbox">', 'Off by default so portraits stay character-focused.')}
        ${settingRow('people_portrait_save_gallery', 'Also save to ST character gallery', '<input id="people_portrait_save_gallery" type="checkbox">', 'Off by default. Only the result you choose becomes the dossier portrait either way.')}
        <div class="ppl-actions ppl-tuning-actions">
          <div id="people_reset_portrait_theme" class="menu_button"><i class="fa-solid fa-rotate-left"></i> Reset Fantasy Anime style</div>
          <div id="people_save_portrait_settings" class="menu_button"><i class="fa-solid fa-floppy-disk"></i> Save prompt settings</div>
          <small id="people_portrait_settings_status" class="ppl-muted">Saved</small>
        </div>`;
        const rules = `
        <section class="delta-settings-subsection ppl-relationship-rules">
          <h4>Relationship scoring</h4>
          <p class="ppl-muted">The scanner proposes deltas; code applies them and clamps each stat to its impact-tier cap. Stats run from -100 to +100 around neutral 0. Starting values affect new NPCs only.</p>
          <div class="ppl-tuning-grid">
            <div class="ppl-tuning-group"><b>New NPC starting values</b>
              <label>Trust <input id="people_base_trust" type="number" min="-100" max="100" class="text_pole ppl-number"></label>
              <label>Affection <input id="people_base_affection" type="number" min="-100" max="100" class="text_pole ppl-number"></label>
              <label>Desire <input id="people_base_desire" type="number" min="-100" max="100" class="text_pole ppl-number"></label>
              <label>Tension <input id="people_base_tension" type="number" min="-100" max="100" class="text_pole ppl-number"></label>
            </div>
            <div class="ppl-tuning-group"><b>Points per event</b>
              <label>Ordinary <input id="people_cap_ordinary" type="number" min="0" max="25" class="text_pole ppl-number"></label>
              <label>Meaningful <input id="people_cap_meaningful" type="number" min="0" max="35" class="text_pole ppl-number"></label>
              <label>Major <input id="people_cap_major" type="number" min="0" max="50" class="text_pole ppl-number"></label>
              <label>Extreme <input id="people_cap_extreme" type="number" min="0" max="100" class="text_pole ppl-number"></label>
            </div>
            <div class="ppl-tuning-group"><b>Events per story day, for each person</b>
              <label>Ordinary <input id="people_allow_ordinary" type="number" min="0" max="99" step="1" class="text_pole ppl-number" placeholder="no limit"></label>
              <label>Meaningful <input id="people_allow_meaningful" type="number" min="0" max="99" step="1" class="text_pole ppl-number" placeholder="no limit"></label>
              <label>Major <input id="people_allow_major" type="number" min="0" max="99" step="1" class="text_pole ppl-number" placeholder="no limit"></label>
              <label>Extreme <input id="people_allow_extreme" type="number" min="0" max="99" step="1" class="text_pole ppl-number" placeholder="no limit"></label>
            </div>
          </div>
          <p class="ppl-muted">An event over its allowance counts as the next tier down; with no tier left, it moves nothing. Blank means no limit, 0 means none. This needs the story clock (Story Director): without it there is no daily limit.</p>
          <label class="ppl-rubric-label" for="people_relationship_criteria"><b>Relationship stat criteria</b><small>Sent to the private dossier scanner. Adjust the definitions and evidence rules for your RP.</small></label>
          <textarea id="people_relationship_criteria" class="text_pole ppl-rubric-textarea" rows="7"></textarea>
          <label class="ppl-rubric-label" for="people_impact_criteria"><b>Impact-tier criteria</b><small>What counts as ordinary, meaningful, major or extreme. Code caps apply even if the model proposes more.</small></label>
          <textarea id="people_impact_criteria" class="text_pole ppl-rubric-textarea" rows="6"></textarea>
          <div class="ppl-actions ppl-tuning-actions"><div id="people_reset_relationship_rules" class="menu_button"><i class="fa-solid fa-rotate-left"></i> Reset relationship rules</div></div>
        </section>
        <section class="delta-settings-subsection ppl-memory-rules">
          <h4>Important memories</h4>
          <p class="ppl-muted">Decides which established events become persistent Important memories during scans and backfills. Existing memories are shown to the scanner to avoid duplicates.</p>
          <label class="ppl-rubric-label" for="people_memory_criteria"><b>Important memory criteria</b><small>Keep routine dialogue, transient feelings and moment-to-moment Inner Chatter out unless you intend otherwise.</small></label>
          <textarea id="people_memory_criteria" class="text_pole ppl-rubric-textarea" rows="7"></textarea>
          <div class="ppl-actions ppl-tuning-actions"><div id="people_reset_memory_rules" class="menu_button"><i class="fa-solid fa-rotate-left"></i> Reset memory criteria</div></div>
        </section>
        <section class="delta-settings-subsection ppl-behavior-rules">
          <h4>Behavior expression</h4>
          <p class="ppl-muted">Injected only with present NPCs. Personality, Behavioral profile, Speech and Mannerisms stay authoritative; relationship stats only tint player-specific expression and never imply obedience or a romance archetype.</p>
          <label class="ppl-rubric-label" for="people_behavior_criteria"><b>Relationship-to-behavior rubric</b><small>Edit if your RP uses different behavioral assumptions.</small></label>
          <textarea id="people_behavior_criteria" class="text_pole ppl-rubric-textarea" rows="8"></textarea>
          <div class="ppl-actions ppl-tuning-actions"><div id="people_reset_behavior_rules" class="menu_button"><i class="fa-solid fa-rotate-left"></i> Reset behavior rubric</div></div>
        </section>`;
        const maintenance = `
        <div class="ppl-actions delta-settings-maintenance-actions">
          <button type="button" class="menu_button" data-delta-settings-backup><i class="fa-solid fa-file-export"></i> Backup / Export</button>
          <button type="button" class="menu_button" data-delta-settings-restore><i class="fa-solid fa-file-import"></i> Restore / Import</button>
          <button type="button" class="menu_button" data-delta-settings-diagnostics><i class="fa-solid fa-stethoscope"></i> Diagnostics</button>
        </div>
        <details class="delta-settings-current-roster">
          <summary><b>Current chat roster</b><small>Edit, scan, archive or remove individual records</small></summary>
          <div id="people_roster_summary" class="ppl-roster-summary"></div>
        </details>
        <div class="delta-settings-danger story-suite-danger">
          <span><b>Clear chat dossier</b><small>Removes every NPC record for this chat only.</small></span>
          <div id="people_clear_chat" class="menu_button redWarningBG"><i class="fa-solid fa-trash"></i> Clear</div>
        </div>`;
        // One closed fold for what a reader rarely needs; each part keeps its own fold inside, so its key, its slot and its
        // open state stay as they were. The first line says whether the calendar here matters (syncExpertNote).
        const expert = `<p class="ppl-muted delta-expert-note" data-delta-expert-note></p>
        ${settingsGroup('calendar', 'Calendar & birthdays', 'Fantasy months and optional campaign clock', '')}
        ${settingsGroup('rules', 'Scanner rules', 'Advanced relationship, memory and behavior rubrics', rules)}
        ${settingsGroup('sent', "What's sent", 'The text your next reply gets, and its size', `<div class="delta-whats-sent" data-delta-whats-sent><small class="delta-whats-sent-empty">Open this to see it.</small></div><div class="ppl-actions"><div id="people_sent_refresh" class="menu_button"><i class="fa-solid fa-rotate"></i> Refresh</div></div>`)}
        ${settingsGroup('advanced', 'Advanced', 'Scan context, output and injection limits, branch handling', advanced)}`;
        return `
    <div id="${UI_ID}" class="extension_container ppl-extension">
      <h4 class="ppl-heading">NPC State</h4>
        <div class="ppl-drawer story-suite-panel">
          <div class="delta-settings-quickbar story-suite-quickbar">
            <div class="delta-settings-quick-toggles">
              ${settingRow('people_enabled', 'Enable NPC State', '<input id="people_enabled" type="checkbox">')}
              ${settingRow('people_auto', 'Auto scan', '<input id="people_auto" type="checkbox">', 'Runs after assistant replies.')}
            </div>
            <div class="ppl-actions delta-settings-quick-actions story-suite-actions">
              <div id="people_scan_now" class="menu_button"><i class="fa-solid fa-wand-magic-sparkles"></i> Scan dossier now</div>
              <div id="people_add_manual" class="menu_button"><i class="fa-solid fa-user-plus"></i> Add NPC</div>
            </div>
          </div>
          <div class="delta-settings-experience story-suite-folds">
            ${settingsGroup('scanning', 'Scanning', 'Connection, cadence and admission', scanning)}
            ${settingsGroup('roster', 'Roster & continuity', 'Injection, lifecycle and stale cleanup', roster)}
            ${settingsGroup('presets', 'Meter presets', 'One-click meter sets (Companion, Rival, Mentor)', '<div class="delta-meter-presets" data-delta-meter-presets></div>', { hidden: true })}
            ${settingsGroup('portrait', 'Portrait generation', 'Image Generation prompts and style', portrait)}
            ${settingsGroup('maintenance', 'Data & maintenance', 'Backup, diagnostics and this chat', maintenance)}
            ${settingsGroup('expert', 'Expert', "Calendar, scanner rules, what's sent, advanced", expert)}
          </div>
        </div>
    </div>`;
    }

    const SETTINGS_OPEN_GROUPS_KEY = 'npc_state_delta_settings_open_groups';
    const DEFAULT_OPEN_SETTINGS_GROUPS = ['scanning'];

    function readOpenSettingsGroups() {
        try {
            const raw = globalThis.localStorage?.getItem?.(SETTINGS_OPEN_GROUPS_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : DEFAULT_OPEN_SETTINGS_GROUPS;
        } catch {
            return DEFAULT_OPEN_SETTINGS_GROUPS;
        }
    }

    // (1.2.14) A long setting hint reads as its first sentence; "more" shows the rest in place. The
    // rows come from several modules (some fill their slots later), so hints are compacted when a
    // group opens. Presentation only: every setting, its key and its text stay as they are.
    const HINT_COMPACT_CHARS = 110;
    function compactSettingHints(root) {
        for (const small of root?.querySelectorAll?.('.ppl-setting-row > span:first-child > small:not([data-delta-hint])') || []) {
            small.dataset.deltaHint = '1';
            if (small.children?.length) continue;
            const text = String(small.textContent || '').trim();
            const split = text.length > HINT_COMPACT_CHARS ? text.match(/^(.{20,160}?[.!?])\s+(\S[\s\S]*)$/) : null;
            if (!split) continue;
            const rest = document.createElement('span');
            rest.className = 'delta-hint-rest';
            rest.textContent = ` ${split[2]}`;
            const more = document.createElement('span');
            more.className = 'delta-hint-more';
            more.setAttribute('role', 'button');
            more.setAttribute('tabindex', '0');
            more.textContent = 'more';
            small.title = text;
            small.replaceChildren(document.createTextNode(split[1]), rest, document.createTextNode(' '), more);
        }
    }

    function toggleSettingHint(event) {
        const more = event.target?.closest?.('.delta-hint-more');
        if (!more) return;
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        // Inside the row's label: keep the click from toggling the setting.
        event.preventDefault();
        event.stopPropagation();
        const small = more.parentElement;
        const open = !small.classList.contains('is-open');
        small.classList.toggle('is-open', open);
        more.textContent = open ? 'less' : 'more';
    }

    // Remember which settings groups the player keeps open; presentation only, never canonical state.
    function bindSettingsGroupMemory(root) {
        const groups = [...(root?.querySelectorAll?.('[data-delta-settings-group]') || [])];
        const open = new Set(readOpenSettingsGroups());
        for (const group of groups) group.open = open.has(group.dataset.deltaSettingsGroup);
        for (const group of groups) if (group.open) setTimeout(() => compactSettingHints(group), 0);
        root?.addEventListener?.('click', toggleSettingHint, true);
        root?.addEventListener?.('keydown', toggleSettingHint, true);
        root?.addEventListener?.('toggle', event => {
            if (!event.target?.matches?.('[data-delta-settings-group]')) return;
            if (event.target.open) compactSettingHints(event.target);
            if (event.target.open && event.target.matches('[data-delta-settings-group="expert"]')) syncExpertNote(event.target);
            const next = groups.filter(group => group.open).map(group => group.dataset.deltaSettingsGroup);
            try { globalThis.localStorage?.setItem?.(SETTINGS_OPEN_GROUPS_KEY, JSON.stringify(next)); } catch { /* optional */ }
        }, true);
    }

    // The Expert fold's first line: whether the calendar in Delta's settings matters. It says the Story Director sentence only
    // while that is true (Story Director's calendar answers).
    const EXPERT_NOTES = Object.freeze({
        'story-director': 'Rarely needed. With Story Director installed its calendar is used, so the calendar here only matters on its own.',
        none: 'Rarely needed. No Story Director calendar is linked, so the calendar here is the one in use.',
    });
    function syncExpertNote(root = globalThis.document) {
        const note = root?.querySelector?.('[data-delta-expert-note]');
        if (!note) return;
        let link = 'none';
        try { link = rt.peopleAdapter?.calendarLink?.() ?? 'none'; } catch { link = 'none'; }
        const text = EXPERT_NOTES[link] ?? EXPERT_NOTES.none;
        if (note.textContent !== text) note.textContent = text;
    }

    function syncSettingsControls() {
        syncExpertNote();
        const s = getSettings();
        $('#people_enabled').prop('checked', !!s.enabled);
        $('#people_auto').prop('checked', !!s.autoScan);
        $('#people_full_scan_every_turn').prop('checked', !!s.fullScanEveryTurn);
        $('#people_narration_capture').prop('checked', !!s.narrationCapture);
        $('#people_scan_every').val(s.scanEvery);
        $('#people_scan_depth').val(s.scanDepth);
        $('#people_narration_capture_catch_up').val(s.narrationCaptureCatchUp);
        $('#people_narration_capture_catch_up_people').val(s.narrationCaptureCatchUpPeople);
        $('#people_admission_mode').val(s.admissionMode);
        $('#people_max').val(s.maxNpcs);
        $('#people_auto_prune_stale').prop('checked', s.autoPruneStale !== false);
        $('#people_stale_archive_after').val(s.staleArchiveAfter);
        $('#people_stale_delete_after').val(s.staleDeleteAfter);
        $('#people_inject').prop('checked', !!s.inject);
        $('#people_inject_budget').val(s.injectBudgetTokens);
        $('#people_inject_limit').val(s.injectLimit);
        $('#people_custom_fields').val((s.customFieldNames || []).join(', '));
        $('#people_archive_deaths').prop('checked', s.autoArchiveDeaths !== false);
        $('#people_reactivate_archived').prop('checked', s.autoReactivateArchived !== false);
        $('#people_layered_secrets').prop('checked', s.layeredSecrets !== false);
        if (!rt.portraitSettingsDirty) writePortraitSettingsDraftToUi(portraitSettingsSnapshot(s));
        updatePortraitSettingsSaveUi();
        $('#people_base_trust').val(s.relationshipBaseline.trust);
        $('#people_base_affection').val(s.relationshipBaseline.affection);
        $('#people_base_desire').val(s.relationshipBaseline.desire);
        $('#people_base_tension').val(s.relationshipBaseline.tension);
        $('#people_cap_ordinary').val(s.relationshipCaps.ordinary);
        $('#people_cap_meaningful').val(s.relationshipCaps.meaningful);
        $('#people_cap_major').val(s.relationshipCaps.major);
        $('#people_cap_extreme').val(s.relationshipCaps.extreme);
        for (const tier of ['ordinary', 'meaningful', 'major', 'extreme']) $(`#people_allow_${tier}`).val(s.relationshipAllowance?.[tier] ?? '');
        $('#people_relationship_criteria').val(s.relationshipCriteria);
        $('#people_impact_criteria').val(s.relationshipImpactCriteria);
        $('#people_memory_criteria').val(s.memoryCriteria);
        $('#people_behavior_criteria').val(s.behaviorCriteria);
    }

    return { buildSettingsHtml, bindSettingsGroupMemory, syncSettingsControls };
}
