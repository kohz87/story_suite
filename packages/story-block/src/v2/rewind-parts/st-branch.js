// How SillyTavern makes a branch of the chat, opens one again, or makes one and stays (stBranch, stReopen, stCreateBranch).

const BOOKMARKS = '/scripts/bookmarks.js';

/** SillyTavern's branch function for `ctx`: (index) → Promise<branch name | null>. */
export function stBranch(ctx, { importer = path => import(path) } = {}) {
    return async index => {
        if (typeof ctx?.branchChat === 'function') return ctx.branchChat(index);
        try {
            const bookmarks = await importer(BOOKMARKS);
            if (typeof bookmarks?.branchChat === 'function') return bookmarks.branchChat(index);
        } catch { /* not a SillyTavern page, or a version that moved it: try the slash command */ }
        if (typeof ctx?.executeSlashCommandsWithOptions === 'function') {
            const out = await ctx.executeSlashCommandsWithOptions(`/branch-create ${index}`, { handleExecutionErrors: true });
            const name = typeof out?.pipe === 'string' ? out.pipe.trim() : '';
            return name || null;
        }
        throw new Error('This SillyTavern has no way to branch a chat that Story Block knows of.');
    };
}

/** SillyTavern's way back to chat `name`: (name) → Promise. */
export function stReopen(ctx, { live = () => globalThis.SillyTavern?.getContext?.() ?? ctx } = {}) {
    return async name => {
        const c = live() ?? ctx;
        if (c?.groupId !== undefined && c?.groupId !== null && c?.groupId !== '' && typeof c.openGroupChat === 'function') return c.openGroupChat(c.groupId, name);
        if (typeof c?.openCharacterChat === 'function') return c.openCharacterChat(name);
        throw new Error('This SillyTavern has no way to open a chat again that Story Block knows of.');
    };
}

/** SillyTavern's "make a branch, stay here": (index) → Promise<branch name | null>. */
export function stCreateBranch(ctx, { importer = path => import(path), branch = stBranch(ctx, { importer }), reopen = stReopen(ctx), live = () => globalThis.SillyTavern?.getContext?.() ?? ctx } = {}) {
    return async index => {
        if (typeof ctx?.createBranch === 'function') return ctx.createBranch(index);
        try {
            const bookmarks = await importer(BOOKMARKS);
            if (typeof bookmarks?.createBranch === 'function') return bookmarks.createBranch(index);
        } catch { /* not a SillyTavern page, or a version that moved it: branch and come back */ }
        // Only a way that opens the branch is left: make it, then open the chat the reader was in again.
        const c = live() ?? ctx;
        const from = typeof c?.getCurrentChatId === 'function' ? c.getCurrentChatId() : c?.chatId;
        const name = await branch(index);
        if (name && from) await reopen(from);
        return name;
    };
}
