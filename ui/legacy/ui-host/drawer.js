// Story Block v2's page furniture: the Extensions drawer and the wand menu entry, moved out of mountUi unchanged: version, modules, the same buttons, and the
// status strip's switch (shown only while some screen asks for the strip). `createDrawerUi(deps)` gives mountUi the two builders and what refresh() sets.
import { IDS, el, iconButton, S, hudOn } from './shared.js';
import { fill } from '../../../core/strings.js';

export function createDrawerUi({ doc, ctx, screens, openSettings, openPanel, setHud, version = '' }) {
    const drawerStatus = el(doc, 'p', 'story-suite-muted');
    let hudCheck = null;
    let hudRowNode = null;
    // The strip's switch is shown only while some screen asks for the strip (a `hud` mount); the stored choice stays either way.
    const hudAsked = () => screens.list('hud').length > 0;
    function drawer() {
        const host = doc.querySelector('#extensions_settings2') ?? doc.querySelector('#extensions_settings');
        if (!host || doc.querySelector(`#${IDS.drawer}`)) return;
        const root = el(doc, 'div', 'inline-drawer story-suite-drawer');
        root.id = IDS.drawer;
        const toggle = el(doc, 'div', 'inline-drawer-toggle inline-drawer-header');
        toggle.appendChild(el(doc, 'b', '', fill(S.drawer.title, { version }).trim()));
        toggle.appendChild(el(doc, 'div', 'inline-drawer-icon fa-solid fa-circle-chevron-down down'));
        const content = el(doc, 'div', 'inline-drawer-content');
        const buttons = el(doc, 'div', 'story-suite-drawer-buttons');
        const one = iconButton(doc, '', 'fa-sliders', S.drawer.settings);
        const two = iconButton(doc, '', 'fa-book-open', S.drawer.panel);
        one.addEventListener('click', () => openSettings());
        two.addEventListener('click', openPanel);
        buttons.append(one, two);
        // The status strip's switch (on by default, MODULES §F54).
        const hudRow = el(doc, 'label', 'checkbox_label story-suite-hud-toggle');
        hudRow.title = S.drawer.hudTitle;
        hudRowNode = hudRow;
        hudRow.hidden = !hudAsked();
        hudCheck = el(doc, 'input');
        hudCheck.type = 'checkbox';
        hudCheck.setAttribute('type', 'checkbox');
        hudCheck.checked = hudOn(ctx.extensionSettings);
        hudCheck.addEventListener('change', () => setHud(hudCheck.checked));
        hudRow.append(hudCheck, el(doc, 'span', '', S.drawer.hud));
        content.append(drawerStatus, buttons, hudRow);
        root.append(toggle, content);
        host.appendChild(root);
        // NPC State's settings are a section of this one drawer; if it mounted first, it moves in now.
        const npc = doc.querySelector('#npc_state_delta_settings');
        if (npc && !content.contains(npc)) content.appendChild(npc);
    }
    function menu() {
        const host = doc.querySelector('#extensionsMenu');
        if (!host || doc.querySelector(`#${IDS.menu}`)) return;
        const item = el(doc, 'div', 'list-group-item flex-container flexGap5 interactable');
        item.id = IDS.menu;
        item.tabIndex = 0;
        item.append(el(doc, 'div', 'fa-solid fa-sliders extensionsMenuExtensionButton'), el(doc, 'span', '', S.menu.suite));
        item.addEventListener('click', () => openSettings());
        host.appendChild(item);
    }

    // What refresh() keeps current in the drawer: the strip's switch and whether it shows.
    const syncHud = () => {
        if (hudCheck) hudCheck.checked = hudOn(ctx.extensionSettings);
        if (hudRowNode) hudRowNode.hidden = !hudAsked();
    };

    return { drawer, menu, drawerStatus, hudAsked, syncHud };
}
