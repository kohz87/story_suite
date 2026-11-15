// Token-counting constants and the characters-to-tokens helper the estimate and preview parts share.

// tokens() (docs/STORY_SUITE.md, api.manage.tokens): about four characters a token.
export const CHARS_PER_TOKEN = 4;
// The one-pass capture block the model writes back, until this session has seen one.
export const NARRATION_CAPTURE_OUTPUT_ESTIMATE_CHARS = 1200;

export const tokensFor = chars => Math.ceil(Math.max(0, Number(chars) || 0) / CHARS_PER_TOKEN);
