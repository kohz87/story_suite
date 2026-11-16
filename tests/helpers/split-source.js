// Source-reading tests look for text in a file (a call, a string, an ordering of two functions). A file that was split into parts keeps its
// path but not all of its text; `sourceOf` returns the text a source-reading test should look at: the file followed by its parts, so the
// test still sees every line the file had before the split. Add a file here when it is split and a test reads its text.
import { readFileSync } from 'node:fs';

const ROOT = new URL('../../packages/story-block/', import.meta.url);

/** facade path (from the repository root) → the parts moved out of it, in the order they appear in the folder. */
export const SPLIT_PARTS = Object.freeze({
    '../../core/commands.js': [
        '../../core/commands/shared.js', '../../core/commands/state.js', '../../core/commands/guards.js', '../../core/commands/ctx.js', '../../core/commands/transact.js',
    ],
    '../../core/store.js': [
        '../../core/store/constants.js', '../../core/store/digest.js', '../../core/store/tombs.js', '../../core/store/sources.js', '../../core/store/guards.js',
        '../../core/store/walk.js', '../../core/store/replay-blocks.js', '../../core/store/memo.js', '../../core/store/read.js',
        '../../core/store/write.js', '../../core/store/write/saving.js', '../../core/store/write/story.js', '../../core/store/write/replace.js',
        '../../core/store/write/records.js', '../../core/store/write/lifecycle.js', '../../core/store/chains.js', '../../core/store-parts/create.js',
    ],
    '../../core/timeline/boundary.js': ['../../core/timeline/boundary-parts/marker.js', '../../core/timeline/boundary-parts/write-check.js'],
    'src/v2/ui-host.js': [
        'src/v2/ui-host/shared.js', 'src/v2/ui-host/shared-parts/dom-build.js', 'src/v2/ui-host/shared-parts/game-view-key.js', 'src/v2/ui-host/shared-parts/names.js', 'src/v2/ui-host/shared-parts/reader-settings.js', 'src/v2/ui-host/shared-parts/reply-record.js', 'src/v2/ui-host/setup.js', 'src/v2/ui-host/screens.js',
        'src/v2/ui-host/replies.js', 'src/v2/ui-host/mounts.js', 'src/v2/ui-host/navigation.js',
        'src/v2/ui-host/panel.js', 'src/v2/ui-host/settings.js', 'src/v2/ui-host/events.js',
    ],
    '../../core/store/write.js': [
        '../../core/store/write/saving.js', '../../core/store/write/story.js', '../../core/store/write/replace.js',
        '../../core/store/write/records.js', '../../core/store/write/lifecycle.js',
    ],
    '../../core/turn.js': [
        '../../core/turn/text.js', '../../core/turn/text-parts/battle-marker.js', '../../core/turn/text-parts/closing-cue.js', '../../core/turn/text-parts/content.js', '../../core/turn/text-parts/context-room.js', '../../core/turn/text-parts/kept-lines.js', '../../core/turn/text-parts/names.js', '../../core/turn/text-parts/quiet-mark.js', '../../core/turn/text-parts/restore-missing.js', '../../core/turn/text-parts/timeout.js', '../../core/turn/session.js', '../../core/turn/reread.js',
        '../../core/turn/prompt-build.js', '../../core/turn/prompt-hooks.js', '../../core/turn/capture-flow.js', '../../core/turn/events.js',
        '../../core/turn-parts/keys.js', '../../core/turn-parts/prompt-limits.js', '../../core/turn-parts/hook-time.js', '../../core/turn-parts/waits.js', '../../core/turn-parts/create-turn.js',
    ],
    '../../core/timeline/coordinator.js': ['../../core/timeline/coordinator-native.js', '../../core/timeline/coordinator-prepare.js', '../../core/timeline/coordinator-prepare/finish.js', '../../core/timeline/coordinator-read.js', '../../core/timeline/coordinator-restore.js'],
    '../../core/timeline/selection-fallback.js': [
        '../../core/timeline/selection-fallback-parts/boundary.js', '../../core/timeline/selection-fallback-parts/chain.js', '../../core/timeline/selection-fallback-parts/settled.js',
    ],
    'src/v2/domains/inventory.js': [
        'src/v2/domains/inventory/state.js', 'src/v2/domains/inventory/validate.js', 'src/v2/domains/inventory/queries.js', 'src/v2/domains/inventory/prompt.js',
        'src/v2/domains/inventory/state-parts/carry.js', 'src/v2/domains/inventory/state-parts/checks.js', 'src/v2/domains/inventory/state-parts/cond-read.js', 'src/v2/domains/inventory/state-parts/cond-write.js', 'src/v2/domains/inventory/state-parts/feature-checks.js', 'src/v2/domains/inventory/state-parts/features.js', 'src/v2/domains/inventory/state-parts/kinds.js', 'src/v2/domains/inventory/state-parts/limits.js', 'src/v2/domains/inventory/state-parts/shape.js', 'src/v2/domains/inventory/state-parts/shared-cond.js',
        'src/v2/domains/inventory/queries-parts/carry.js', 'src/v2/domains/inventory/queries-parts/definitions.js', 'src/v2/domains/inventory/queries-parts/encumbrance.js', 'src/v2/domains/inventory/queries-parts/equipment.js', 'src/v2/domains/inventory/queries-parts/gear-names.js', 'src/v2/domains/inventory/queries-parts/list.js', 'src/v2/domains/inventory/queries-parts/shared-ask.js',
        'src/v2/domains/inventory/prompt-parts/packing.js', 'src/v2/domains/inventory/prompt-parts/phrases.js', 'src/v2/domains/inventory/prompt-parts/tail.js',
    ],
    'src/v2/host-ui.js': [
        'src/v2/host-ui/text.js',
        'src/v2/host-ui/controls.js',
        'src/v2/host-ui/sent.js',
        'src/v2/host-ui/tab-host.js',
        'src/v2/host-ui-parts/diagnostics-keys.js',
        'src/v2/host-ui-parts/feature-row.js',
        'src/v2/host-ui-parts/settings-host.js',
        'src/v2/host-ui/text-parts/fold-ids-main.js',
        'src/v2/host-ui/text-parts/fold-ids-more.js',
        'src/v2/host-ui/text-parts/fold-ids-sub.js',
        'src/v2/host-ui/text-parts/page-text.js',
        'src/v2/host-ui/text-parts/settings-text.js',
        'src/v2/host-ui/controls-parts/dom.js',
        'src/v2/host-ui/controls-parts/field-control.js',
        'src/v2/host-ui/controls-parts/field-row.js',
        'src/v2/host-ui/controls-parts/groups.js',
        'src/v2/host-ui/controls-parts/list-lines.js',
        'src/v2/host-ui/controls-parts/row-value.js',
        'src/v2/host-ui/controls-parts/values.js',
    ],
    'src/v2/packs/validate.js': [
        'src/v2/packs/validate/core.js', 'src/v2/packs/validate/items.js', 'src/v2/packs/validate/events-economy.js', 'src/v2/packs/validate/world.js', 'src/v2/packs/validate/theme.js',
    ],
    'src/v2/packs/validate/events-economy.js': [
        'src/v2/packs/validate/events-economy-parts/events.js', 'src/v2/packs/validate/events-economy-parts/economy.js', 'src/v2/packs/validate/events-economy-parts/weather.js',
        'src/v2/packs/validate/events-economy-parts/creation.js', 'src/v2/packs/validate/events-economy-parts/skills.js',
    ],
    'src/v2/packs/validate/items.js': [
        'src/v2/packs/validate/items-parts/items.js', 'src/v2/packs/validate/items-parts/trade.js', 'src/v2/packs/validate/items-parts/crafts.js',
        'src/v2/packs/validate/items-parts/character.js', 'src/v2/packs/validate/items-parts/skill-sets.js',
    ],
    'src/v2/packs/validate/world.js': [
        'src/v2/packs/validate/world-parts/places.js', 'src/v2/packs/validate/world-parts/terms.js',
        'src/v2/packs/validate/world-parts/markets.js', 'src/v2/packs/validate/world-parts/calendar.js',
    ],
    'src/v2/packs/version.js': [
        'src/v2/packs/version-parts/shared-tag.js', 'src/v2/packs/version-parts/single.js', 'src/v2/packs/version-parts/range.js', 'src/v2/packs/version-parts/satisfy.js',
    ],
    'src/v2/view/template/render.js': [
        'src/v2/view/template/render/view.js', 'src/v2/view/template/render/blocks.js', 'src/v2/view/template/render/elements.js',
        'src/v2/view/template/render/widgets.js', 'src/v2/view/template/render/dom.js', 'src/v2/view/template/render/page-ids.js',
        'src/v2/view/template/render/dom-parts/access.js', 'src/v2/view/template/render/dom-parts/controls.js', 'src/v2/view/template/render/page-ids-parts/copies.js', 'src/v2/view/template/render/page-ids-parts/prefix.js', 'src/v2/view/template/render/page-ids-parts/value.js',
    ],
    '../../core/runtime.js': ['../../core/runtime-parts/version.js', '../../core/runtime-parts/create.js'],
    'src/v2/reply-notes.js': ['src/v2/reply-notes-parts/problems.js', 'src/v2/reply-notes-parts/notes.js'],
    '../../core/timeline/rewind.js': ['../../core/timeline/rewind-parts/st-branch.js', '../../core/timeline/rewind-parts/shared-limits.js', '../../core/timeline/rewind-parts/rewind.js', '../../core/timeline/rewind-parts/save-points.js'],
    'src/v2/rpg-lazy.js': ['src/v2/rpg-lazy-parts/holds.js', 'src/v2/rpg-lazy-parts/library.js', 'src/v2/rpg-lazy-parts/stand-in.js'],
    '../../core/runtime/saving.js': [
        '../../core/runtime/saving-parts/shared-plain.js', '../../core/runtime/saving-parts/page-marks.js', '../../core/runtime/saving-parts/rescue-lookup.js',
        '../../core/runtime/saving-parts/unload.js', '../../core/runtime/saving-parts/store-saving.js',
    ],
    'src/v2/view/theme.js': [
        'src/v2/view/theme-parts/bridge.js', 'src/v2/view/theme-parts/colors.js', 'src/v2/view/theme-parts/css.js', 'src/v2/view/theme-parts/defaults.js', 'src/v2/view/theme-parts/fonts.js', 'src/v2/view/theme-parts/glass.js', 'src/v2/view/theme-parts/options.js', 'src/v2/view/theme-parts/palettes.js', 'src/v2/view/theme-parts/roots.js', 'src/v2/view/theme-parts/scheme-choice.js', 'src/v2/view/theme-parts/scheme-tokens.js', 'src/v2/view/theme-parts/sheet-tokens.js', 'src/v2/view/theme-parts/text-size.js', 'src/v2/view/theme-parts/tint.js', 'src/v2/view/theme-parts/tokens.js',
    ],
    'src/v2/view/template/sanitize.js': [
        'src/v2/view/template/sanitize-parts/attr-tables.js', 'src/v2/view/template/sanitize-parts/attrs.js', 'src/v2/view/template/sanitize-parts/control-types.js', 'src/v2/view/template/sanitize-parts/filter.js', 'src/v2/view/template/sanitize-parts/paint.js', 'src/v2/view/template/sanitize-parts/purify-config.js', 'src/v2/view/template/sanitize-parts/reserved.js', 'src/v2/view/template/sanitize-parts/run.js', 'src/v2/view/template/sanitize-parts/tags.js', 'src/v2/view/template/sanitize-parts/urls.js',
    ],
    'src/v2/view/widgets/dialog.js': [
        'src/v2/view/widgets/dialog-parts/content.js', 'src/v2/view/widgets/dialog-parts/props.js', 'src/v2/view/widgets/dialog-parts/render.js', 'src/v2/view/widgets/dialog-parts/shared-text.js', 'src/v2/view/widgets/dialog-parts/widget.js',
    ],
    'src/v2/view/template/render/dom.js': ['src/v2/view/template/render/dom-parts/access.js', 'src/v2/view/template/render/dom-parts/controls.js'],
    'src/v2/view/template/render/page-ids.js': ['src/v2/view/template/render/page-ids-parts/copies.js', 'src/v2/view/template/render/page-ids-parts/prefix.js', 'src/v2/view/template/render/page-ids-parts/value.js'],
    'src/v2/view/widgets/nav.js': [
        'src/v2/view/widgets/nav-parts/shared-limits.js', 'src/v2/view/widgets/nav-parts/shared-short.js', 'src/v2/view/widgets/nav-parts/items.js',
        'src/v2/view/widgets/nav-parts/reveal.js', 'src/v2/view/widgets/nav-parts/widget.js',
    ],
    'src/v2/view/widgets/map.js': ['src/v2/view/widgets/map-parts/props.js', 'src/v2/view/widgets/map-parts/widget.js'],
});

/** The text of `rel` (a path from the repository root) and of the parts moved out of it. */
export function sourceOf(rel) {
    return [rel, ...(SPLIT_PARTS[rel] ?? [])].map(file => readFileSync(new URL(file, ROOT), 'utf8')).join('\n');
}
