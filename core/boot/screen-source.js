// The screens plug-in modules declare, for a view that draws them: `find(id)` → { title, widget: { name, props, render } } or null.
import { BUILTIN_MODULES } from '../modules-list.js';

// Built-in modules' screens are the view's own (several widgets, bindings): never drawn from here.
const BUILT_IN = new Set(['story-block', ...BUILTIN_MODULES.map(m => m.id)]);
const WIDGET_TAG = /<ss-widget\b[^>]*>/i;
const attr = (tag, name) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);

const propsOf = tag => {
    const found = attr(tag, 'data-props');
    try { const value = found ? JSON.parse((found[1] ?? found[2]).replace(/&quot;/g, '"')) : {}; return value && typeof value === 'object' ? value : {}; } catch { return {}; }
};

/** `createScreenSource({ registry })`: only a plug-in (not built-in) module's screen, its module not dormant and its feature on, with a template naming a widget that module declares. */
export function createScreenSource({ registry }) {
    return {
        find(id) {
            for (const def of registry.modules?.() ?? []) {
                if (BUILT_IN.has(def.id)) continue;
                const screen = (def.screens ?? []).find(item => item?.id === id);
                if (!screen || registry.lifecycle?.(def.id)?.status === 'dormant') continue;
                if (screen.feature && !registry.featureOn?.(screen.feature)) return null;
                const tag = WIDGET_TAG.exec(String(screen.template ?? ''));
                const name = tag ? attr(tag[0], 'name') : null;
                const widget = name ? def.widgets?.[name[1] ?? name[2]] : null;
                if (typeof widget?.render !== 'function') return null;
                if (widget.feature && !registry.featureOn?.(widget.feature)) return null;
                return { title: String(screen.title ?? id), widget: { name: name[1] ?? name[2], props: { ...(widget.props ?? {}), ...propsOf(tag[0]) }, render: widget.render } };
            }
            return null;
        },
    };
}
