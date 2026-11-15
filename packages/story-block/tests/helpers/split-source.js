// Source-reading tests look for text in a file (a call, a string, an ordering of two functions). A file that was split into parts keeps its
// path but not all of its text; `sourceOf` returns the text a source-reading test should look at: the file followed by its parts, so the
// test still sees every line the file had before the split. Add a file here when it is split and a test reads its text.
import { readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);

/** facade path (from the repository root) → the parts moved out of it, in the order they appear in the folder. */
export const SPLIT_PARTS = Object.freeze({
    'src/v2/commands.js': [
        'src/v2/commands/shared.js', 'src/v2/commands/state.js', 'src/v2/commands/guards.js', 'src/v2/commands/ctx.js', 'src/v2/commands/transact.js',
    ],
    'src/v2/store.js': [
        'src/v2/store/constants.js', 'src/v2/store/digest.js', 'src/v2/store/tombs.js', 'src/v2/store/sources.js', 'src/v2/store/guards.js',
        'src/v2/store/walk.js', 'src/v2/store/replay-blocks.js', 'src/v2/store/memo.js', 'src/v2/store/read.js',
        'src/v2/store/write.js', 'src/v2/store/write/saving.js', 'src/v2/store/write/story.js', 'src/v2/store/write/replace.js',
        'src/v2/store/write/records.js', 'src/v2/store/write/lifecycle.js', 'src/v2/store/chains.js',
    ],
    'src/v2/ui-host.js': [
        'src/v2/ui-host/shared.js', 'src/v2/ui-host/setup.js', 'src/v2/ui-host/screens.js',
        'src/v2/ui-host/replies.js', 'src/v2/ui-host/mounts.js', 'src/v2/ui-host/navigation.js',
        'src/v2/ui-host/panel.js', 'src/v2/ui-host/settings.js', 'src/v2/ui-host/events.js',
    ],
    'src/v2/store/write.js': [
        'src/v2/store/write/saving.js', 'src/v2/store/write/story.js', 'src/v2/store/write/replace.js',
        'src/v2/store/write/records.js', 'src/v2/store/write/lifecycle.js',
    ],
    'src/v2/turn.js': [
        'src/v2/turn/text.js', 'src/v2/turn/session.js', 'src/v2/turn/reread.js',
        'src/v2/turn/prompt-build.js', 'src/v2/turn/prompt-hooks.js', 'src/v2/turn/capture-flow.js', 'src/v2/turn/events.js',
    ],
    'src/v2/timeline/coordinator.js': ['src/v2/timeline/coordinator-native.js', 'src/v2/timeline/coordinator-prepare.js', 'src/v2/timeline/coordinator-prepare/finish.js', 'src/v2/timeline/coordinator-read.js', 'src/v2/timeline/coordinator-restore.js'],
    'src/v2/domains/inventory.js': [
        'src/v2/domains/inventory/state.js', 'src/v2/domains/inventory/validate.js', 'src/v2/domains/inventory/queries.js', 'src/v2/domains/inventory/prompt.js',
    ],
    'src/v2/host-ui.js': ['src/v2/host-ui/text.js', 'src/v2/host-ui/controls.js', 'src/v2/host-ui/sent.js', 'src/v2/host-ui/tab-host.js'],
    'src/v2/packs/validate.js': [
        'src/v2/packs/validate/core.js', 'src/v2/packs/validate/items.js', 'src/v2/packs/validate/events-economy.js', 'src/v2/packs/validate/world.js', 'src/v2/packs/validate/theme.js',
    ],
    'src/v2/view/template/render.js': [
        'src/v2/view/template/render/view.js', 'src/v2/view/template/render/blocks.js', 'src/v2/view/template/render/elements.js',
        'src/v2/view/template/render/widgets.js', 'src/v2/view/template/render/dom.js', 'src/v2/view/template/render/page-ids.js',
        'src/v2/view/template/render/dom-parts/access.js', 'src/v2/view/template/render/dom-parts/controls.js', 'src/v2/view/template/render/page-ids-parts/copies.js', 'src/v2/view/template/render/page-ids-parts/prefix.js', 'src/v2/view/template/render/page-ids-parts/value.js',
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
});

/** The text of `rel` (a path from the repository root) and of the parts moved out of it. */
export function sourceOf(rel) {
    return [rel, ...(SPLIT_PARTS[rel] ?? [])].map(file => readFileSync(new URL(file, ROOT), 'utf8')).join('\n');
}
