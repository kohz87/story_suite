// Where the screens part's tests find Story Block's view runtime.
//
// * Story Block's view runtime (validateScreen, resolveData, the template renderer, scoped CSS, the
//   condition language, the standard widgets and the card mount) is imported from the live
//   packages/story-block by relative path, so the
//   definitions are checked and the screens rendered in CI too.
// * STORY_BLOCK_DIR (a Story Block checkout's root) renders against that checkout instead.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STORY_BLOCK = new URL('../../../../../core/boot/boot.js/', import.meta.url);
// Story Block's view moved to ui/legacy/view (the events to modules/world/events) when the layout was applied; a
// STORY_BLOCK_DIR checkout from before that still has them under src/v2, so each file is looked up there first.
const ROOT = new URL('../../../../../', import.meta.url);
const MOVED = { 'src/v2/events/index.js': 'modules/world/events/index.js' };
const movedTo = rel => MOVED[rel] ?? rel.replace('src/v2/view/', 'ui/legacy/view/');
const live = await import(new URL(movedTo('src/v2/view/screens.js'), ROOT).href);

const dir = resolve(process.env.STORY_BLOCK_DIR ?? fileURLToPath(STORY_BLOCK));
const file = rel => pathToFileURL(existsSync(join(dir, rel)) ? join(dir, rel) : join(dir, '../..', movedTo(rel))).href;

async function loadRenderer() {
    if (!existsSync(fileURLToPath(file('src/v2/view/template/index.js')))) return { runtime: null, reason: `STORY_BLOCK_DIR (${dir}) has no src/v2/view/template/index.js.` };
    try {
        const [template, bind, css, events, widgets, card, screens] = await Promise.all([
            import(file('src/v2/view/template/index.js')),
            import(file('src/v2/view/bind.js')),
            import(file('src/v2/view/css.js')),
            import(file('src/v2/events/index.js')),
            import(file('src/v2/view/widgets/index.js')),
            import(file('src/v2/view/mounts/card.js')),
            import(file('src/v2/view/screens.js')),
        ]);
        return {
            runtime: {
                compileTemplate: template.compileTemplate,
                renderTemplate: template.renderTemplate,
                evaluate: bind.conditionEvaluator({ compile: events.compile, evaluate: events.evaluate }),
                scopeCss: css.scopeCss,
                widgets: widgets.standardWidgets,
                createCardMount: card.createCardMount,
                createScreens: screens.createScreens,
            },
            reason: '',
        };
    } catch (error) {
        return { runtime: null, reason: `Story Block's renderer could not be loaded from ${dir}: ${error?.message ?? error}` };
    }
}

export const { validateScreen, resolveData, createScreens: liveScreens, CSS_LIMIT } = live;
export const { runtime, reason: skipReason } = await loadRenderer();
