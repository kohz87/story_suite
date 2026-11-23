// The screens modules declare, for a view that draws them: `find(id)` → { title, widget: { name, props, render } } or null.
const WIDGET_TAG = /<ss-widget\b[^>]*>/i;
const attr = (tag, name) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);

const propsOf = tag => {
    const found = attr(tag, 'data-props');
    try { const value = found ? JSON.parse((found[1] ?? found[2]).replace(/&quot;/g, '"')) : {}; return value && typeof value === 'object' ? value : {}; } catch { return {}; }
};

/** `createScreenSource({ registry })`: only a screen whose module is not dormant and whose feature is on, with a template naming a widget that module declares. */
export function createScreenSource({ registry }) {
    return {
        find(id) {
            for (const def of registry.modules?.() ?? []) {
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
