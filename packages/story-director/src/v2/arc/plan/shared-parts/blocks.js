// Story Director v2, part **arc**: regular expressions for stripping reasoning blocks and finding plan blocks.

export const THINK_BLOCK = /<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
export const THINK_CLOSE = /<\/(?:think|thinking|reasoning)\s*>/gi;
export const PLAN_OPEN = /<plan\b[^>]*>/gi;
export const PLAN_CLOSE = /<\/plan\s*>/i;
