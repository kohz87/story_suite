// The elements a browser ends implicitly when another opens (`p`, `li`, `option`, `tr`, `td`/`th`, `dt`/`dd`, table bodies).

const CLOSES_P = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);
export function implicitEnds(tag, stack) {
    const top = () => stack[stack.length - 1];
    if (CLOSES_P.has(tag) && stack.some(node => node.tag === 'p')) {
        for (let i = stack.length - 1; i > 0; i -= 1) {
            if (stack[i].tag === 'p') {
                stack.length = i;
                break;
            }
            if (!['span', 'b', 'i', 'em', 'strong', 'small', 'a', 'label', 'code'].includes(stack[i].tag)) break;
        }
    }
    if (tag === 'li' && top().tag === 'li') stack.pop();
    if ((tag === 'dt' || tag === 'dd') && ['dt', 'dd'].includes(top().tag)) stack.pop();
    if (tag === 'option' && top().tag === 'option') stack.pop();
    if (tag === 'optgroup') {
        if (top().tag === 'option') stack.pop();
        if (top().tag === 'optgroup') stack.pop();
    }
    if ((tag === 'td' || tag === 'th') && ['td', 'th'].includes(top().tag)) stack.pop();
    if (tag === 'tr') {
        if (['td', 'th'].includes(top().tag)) stack.pop();
        if (top().tag === 'tr') stack.pop();
    }
    if (['tbody', 'thead', 'tfoot'].includes(tag)) {
        if (['td', 'th'].includes(top().tag)) stack.pop();
        if (top().tag === 'tr') stack.pop();
        if (['tbody', 'thead', 'tfoot'].includes(top().tag)) stack.pop();
    }
}
