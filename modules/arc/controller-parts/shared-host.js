// Default host environment accessors and carrier predicate for the arc controller.

export function liveSdk() {
    try {
        return globalThis.StoryBlock?.sdk ?? null;
    } catch {
        return null;
    }
}

export function stChat() {
    try {
        const chat = globalThis.SillyTavern?.getContext?.()?.chat;
        return Array.isArray(chat) ? chat : [];
    } catch {
        return [];
    }
}

export function toast(kind, text) {
    try { globalThis.toastr?.[kind]?.(text, 'Story Director'); } catch { /* no toasts here */ }
}

export const isCarrier = message => Boolean(message) && !message.is_user && !message.is_system;
