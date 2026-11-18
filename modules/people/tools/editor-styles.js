/* NPC State's NPC editor styles: one viewport with one scrollbar, the grouped sections, the Advanced fold and the life-state control. */
const STYLE_ID = 'npc_state_delta_dossier_experience_styles';

export function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
/* One editor viewport, one scrollbar. SillyTavern keeps Save/Cancel outside this body. */
.npc-state-delta-editor-popup{--delta-editor-height:min(940px,96dvh);width:min(1320px,97vw)!important;max-width:none!important;height:var(--delta-editor-height)!important;max-height:96dvh!important;margin:auto!important;overflow:hidden!important}
.npc-state-delta-editor-popup .popup-content{display:flex!important;flex-direction:column!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
.npc-state-delta-editor-popup #npc_state_delta_editor_content{flex:1 1 auto!important;min-height:0!important;max-height:calc(var(--delta-editor-height) - 112px)!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;padding-right:8px;scrollbar-gutter:stable}
.npc-state-delta-editor-popup .npc-state-delta-editor-portrait-overrides{display:none!important}
.npc-state-delta-editor-popup .npc-state-delta-editor-head{position:sticky;top:0;z-index:4;margin:-1px -1px 12px;padding:10px 2px 9px;background:color-mix(in srgb,var(--SmartThemeBlurTintColor,#18191d) 96%,black 4%);border-bottom:1px solid rgba(218,193,148,.14)}
.npc-state-delta-editor-popup .delta-editor-section{margin:12px 0;padding:13px;border:1px solid rgba(218,193,148,.16);border-radius:10px;background:rgba(255,255,255,.025)}
.npc-state-delta-editor-popup .delta-editor-section>h4{margin:0 0 11px;color:#e3c985;font-size:.84rem;letter-spacing:.08em;text-transform:uppercase}
.npc-state-delta-editor-popup .delta-editor-section-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}
.npc-state-delta-editor-popup .delta-editor-section-grid>label{display:grid;gap:5px;margin:0;min-width:0}
.npc-state-delta-editor-popup .delta-editor-section-grid>.delta-editor-wide{grid-column:1/-1}
.npc-state-delta-editor-popup .delta-editor-section-grid textarea{resize:vertical;max-width:100%}
.npc-state-delta-editor-popup .npc-state-delta-editor-stats{grid-column:1/-1;margin:2px 0 0}
.npc-state-delta-editor-popup .delta-editor-advanced{margin:12px 0;border:1px solid rgba(218,193,148,.19);border-radius:10px;overflow:hidden}
.npc-state-delta-editor-popup .delta-editor-advanced>summary{display:flex;align-items:baseline;gap:9px;padding:11px 13px;cursor:pointer;color:#e3c985;background:rgba(216,188,120,.045)}
.npc-state-delta-editor-popup .delta-editor-advanced>summary small{color:var(--SmartThemeBodyColor,#ddd);opacity:.55;font-weight:400}
.npc-state-delta-editor-popup .delta-editor-advanced-body{display:grid;gap:10px;padding:12px 13px}
.npc-state-delta-editor-popup .delta-editor-life-control{display:grid;grid-template-columns:minmax(180px,1fr) auto;gap:8px 10px;align-items:end;margin:0;padding:11px;border:1px solid rgba(218,193,148,.14);border-radius:9px;background:rgba(255,255,255,.035)}
.npc-state-delta-editor-popup .delta-editor-life-control label{display:grid;gap:5px;margin:0}
.npc-state-delta-editor-popup .delta-editor-life-control small{grid-column:1/-1;opacity:.72}
.npc-state-delta-editor-popup .delta-editor-life-control>.menu_button{width:auto;white-space:nowrap;margin:0}

@media(max-width:900px){
  .npc-state-delta-editor-popup .delta-editor-section-grid{grid-template-columns:1fr}
  .npc-state-delta-editor-popup .delta-editor-section-grid>.delta-editor-wide{grid-column:1}
}
@media(max-width:650px){
  .npc-state-delta-editor-popup{--delta-editor-height:100dvh;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;border-radius:0!important}
  .npc-state-delta-editor-popup #npc_state_delta_editor_content{max-height:calc(100dvh - 96px)!important;padding-right:4px}
  .npc-state-delta-editor-popup .delta-editor-life-control{grid-template-columns:1fr}
  .npc-state-delta-editor-popup .delta-editor-life-control small{grid-column:1}
}
`;
    document.head.appendChild(style);
}
