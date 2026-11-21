import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFaqData } from '../../scripts/help/faq-data.mjs';

test('the FAQ data file holds the markdown as one string and round-trips quotes, backticks and line ends', async () => {
  const md = '## Q "one"\r\n\r\nUse `x` and \\ here.\r\n';
  const text = renderFaqData(md);
  assert.match(text, /^\/\/ Generated from docs\/FAQ\.md/);
  const url = `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  assert.equal((await import(url)).FAQ_MARKDOWN, md.replace(/\r\n/g, '\n'));
});
