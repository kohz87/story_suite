import { fakeApi, host, installDom } from './fake-dom.js';

export function mount(widget, props, api = fakeApi()) {
    const doc = installDom();
    const el = host(doc);
    const handle = widget.render(el, props, api);
    return { doc, el, api, handle, root: el.children[0] };
}

export const classes = node => (node.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
export const key = (node, name, init = {}) => node.dispatch('keydown', { key: name, ...init });
export const PNG = 'data:image/png;base64,iVBORw0KGgo=';
