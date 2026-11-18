// Source-reading tests look for text in a file (a call, a string, an ordering of two functions). A file that was split into parts keeps its
// path but not all of its text; `sourceOf` returns the text a source-reading test should look at: the file followed by its parts, so the
// test still sees every line the file had before the split. Add a file here when it is split and a test reads its text.
import { readFileSync } from 'node:fs';

// Paths are written from this folder (tests/helpers/), so '../../core/x.js' is the repository's core/x.js.
const ROOT = new URL('./', import.meta.url);

/** facade path (from tests/helpers/) → the parts moved out of it, in the order they appear in the folder. */
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
    '../../ui/legacy/ui-host.js': [
        '../../ui/legacy/ui-host/shared.js', '../../ui/legacy/ui-host/shared-parts/dom-build.js', '../../ui/legacy/ui-host/shared-parts/game-view-key.js', '../../ui/legacy/ui-host/shared-parts/names.js', '../../ui/legacy/ui-host/shared-parts/reader-settings.js', '../../ui/legacy/ui-host/shared-parts/reply-record.js', '../../ui/legacy/ui-host/setup.js', '../../ui/legacy/ui-host/screens.js',
        '../../ui/legacy/ui-host/replies.js', '../../ui/legacy/ui-host/mounts.js', '../../ui/legacy/ui-host/navigation.js',
        '../../ui/legacy/ui-host/panel.js', '../../ui/legacy/ui-host/settings.js', '../../ui/legacy/ui-host/events.js',
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
    '../../ui/legacy/host-ui.js': [
        '../../core/settings-text/text.js',
        '../../ui/legacy/host-ui/controls.js',
        '../../core/sent/sent.js',
        '../../ui/legacy/host-ui/tab-host.js',
        '../../ui/legacy/host-ui-parts/diagnostics-keys.js',
        '../../ui/legacy/host-ui-parts/feature-row.js',
        '../../ui/legacy/host-ui-parts/settings-host.js',
        '../../core/settings-text/text-parts/fold-ids-main.js',
        '../../core/settings-text/text-parts/fold-ids-more.js',
        '../../core/settings-text/text-parts/fold-ids-sub.js',
        '../../core/settings-text/text-parts/page-text.js',
        '../../core/settings-text/text-parts/settings-text.js',
        '../../core/list-lines/dom.js',
        '../../ui/legacy/host-ui/controls-parts/field-control.js',
        '../../ui/legacy/host-ui/controls-parts/field-row.js',
        '../../ui/legacy/host-ui/controls-parts/groups.js',
        '../../core/list-lines/list-lines.js',
        '../../ui/legacy/host-ui/controls-parts/row-value.js',
        '../../core/list-lines/values.js',
    ],
    '../../packs/validate.js': [
        '../../packs/validate/core.js', '../../packs/validate/items.js', '../../packs/validate/events-economy.js', '../../packs/validate/world.js', '../../packs/validate/theme.js',
    ],
    '../../packs/validate/events-economy.js': [
        '../../packs/validate/events-economy-parts/events.js', '../../packs/validate/events-economy-parts/economy.js', '../../packs/validate/events-economy-parts/weather.js',
        '../../packs/validate/events-economy-parts/creation.js', '../../packs/validate/events-economy-parts/skills.js',
    ],
    '../../packs/validate/items.js': [
        '../../packs/validate/items-parts/items.js', '../../packs/validate/items-parts/trade.js', '../../packs/validate/items-parts/crafts.js',
        '../../packs/validate/items-parts/character.js', '../../packs/validate/items-parts/skill-sets.js',
    ],
    '../../packs/validate/world.js': [
        '../../packs/validate/world-parts/places.js', '../../packs/validate/world-parts/terms.js',
        '../../packs/validate/world-parts/markets.js', '../../packs/validate/world-parts/calendar.js',
    ],
    '../../packs/version.js': [
        '../../packs/version-parts/shared-tag.js', '../../packs/version-parts/single.js', '../../packs/version-parts/range.js', '../../packs/version-parts/satisfy.js',
    ],
    '../../packs/template/render.js': [
        '../../packs/template/render/view.js', '../../packs/template/render/blocks.js', '../../packs/template/render/elements.js',
        '../../packs/template/render/widgets.js', '../../packs/template/render/dom.js', '../../packs/template/render/page-ids.js',
        '../../packs/template/render/dom-parts/access.js', '../../packs/template/render/dom-parts/controls.js', '../../packs/template/render/page-ids-parts/copies.js', '../../packs/template/render/page-ids-parts/prefix.js', '../../packs/template/render/page-ids-parts/value.js',
    ],
    '../../core/runtime.js': ['../../core/runtime-parts/version.js', '../../core/runtime-parts/create.js'],
    '../../ui/legacy/reply-notes.js': ['../../ui/legacy/reply-notes-parts/problems.js', '../../ui/legacy/reply-notes-parts/notes.js'],
    '../../core/timeline/rewind.js': ['../../core/timeline/rewind-parts/st-branch.js', '../../core/timeline/rewind-parts/shared-limits.js', '../../core/timeline/rewind-parts/rewind.js', '../../core/timeline/rewind-parts/save-points.js'],
    'src/v2/rpg-lazy.js': ['src/v2/rpg-lazy-parts/holds.js', 'src/v2/rpg-lazy-parts/library.js', 'src/v2/rpg-lazy-parts/stand-in.js'],
    '../../core/runtime/saving.js': [
        '../../core/runtime/saving-parts/shared-plain.js', '../../core/runtime/saving-parts/page-marks.js', '../../core/runtime/saving-parts/rescue-lookup.js',
        '../../core/runtime/saving-parts/unload.js', '../../core/runtime/saving-parts/store-saving.js',
    ],
    '../../ui/legacy/view/theme.js': [
        '../../ui/legacy/view/theme-parts/bridge.js', '../../ui/legacy/view/theme-parts/colors.js', '../../ui/legacy/view/theme-parts/css.js', '../../ui/legacy/view/theme-parts/defaults.js', '../../ui/legacy/view/theme-parts/fonts.js', '../../ui/legacy/view/theme-parts/glass.js', '../../ui/legacy/view/theme-parts/options.js', '../../ui/legacy/view/theme-parts/palettes.js', '../../ui/legacy/view/theme-parts/roots.js', '../../ui/legacy/view/theme-parts/scheme-choice.js', '../../ui/legacy/view/theme-parts/scheme-tokens.js', '../../ui/legacy/view/theme-parts/sheet-tokens.js', '../../ui/legacy/view/theme-parts/text-size.js', '../../ui/legacy/view/theme-parts/tint.js', '../../ui/legacy/view/theme-parts/tokens.js',
    ],
    '../../packs/template/sanitize.js': [
        '../../packs/template/sanitize-parts/attr-tables.js', '../../packs/template/sanitize-parts/attrs.js', '../../packs/template/sanitize-parts/control-types.js', '../../packs/template/sanitize-parts/filter.js', '../../packs/template/sanitize-parts/paint.js', '../../packs/template/sanitize-parts/purify-config.js', '../../packs/template/sanitize-parts/reserved.js', '../../packs/template/sanitize-parts/run.js', '../../packs/template/sanitize-parts/tags.js', '../../packs/template/sanitize-parts/urls.js',
    ],
    '../../packs/widgets/dialog.js': [
        '../../packs/widgets/dialog-parts/content.js', '../../packs/widgets/dialog-parts/props.js', '../../packs/widgets/dialog-parts/render.js', '../../packs/widgets/dialog-parts/shared-text.js', '../../packs/widgets/dialog-parts/widget.js',
    ],
    '../../packs/template/render/dom.js': ['../../packs/template/render/dom-parts/access.js', '../../packs/template/render/dom-parts/controls.js'],
    '../../packs/template/render/page-ids.js': ['../../packs/template/render/page-ids-parts/copies.js', '../../packs/template/render/page-ids-parts/prefix.js', '../../packs/template/render/page-ids-parts/value.js'],
    '../../packs/widgets/nav.js': [
        '../../packs/widgets/nav-parts/shared-limits.js', '../../packs/widgets/nav-parts/shared-short.js', '../../packs/widgets/nav-parts/items.js',
        '../../packs/widgets/nav-parts/reveal.js', '../../packs/widgets/nav-parts/widget.js',
    ],
    '../../packs/widgets/map.js': ['../../packs/widgets/map-parts/props.js', '../../packs/widgets/map-parts/widget.js'],
});

/** The text of `rel` (a path from tests/helpers/) and of the parts moved out of it. */
export function sourceOf(rel) {
    return [rel, ...(SPLIT_PARTS[rel] ?? [])].map(file => readFileSync(new URL(file, ROOT), 'utf8')).join('\n');
}
