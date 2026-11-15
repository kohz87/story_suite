// Story Suite v2: the DOMPurify options Story Block passes.

/** The DOMPurify options Story Block passes (`sanitize(html, PURIFY_CONFIG)`); the allow-list runs after. */
export const PURIFY_CONFIG = Object.freeze({
    ADD_TAGS: ['ss-widget'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'template', 'foreignObject', 'math'],
    FORBID_ATTR: ['action', 'formaction', 'srcdoc', 'srcset', 'ping', 'background'],
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: /^(?:https:|data:image\/|#)/i,
    SAFE_FOR_TEMPLATES: false,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
});
