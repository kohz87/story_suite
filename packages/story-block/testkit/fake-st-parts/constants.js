// The fixed names and values the fake SillyTavern copies: event types, extension prompt types and roles, the Main Prompt.

export const EVENT_TYPES = Object.freeze({
    APP_READY: 'app_ready',
    CHAT_CHANGED: 'chat_id_changed',
    CHAT_RENAMED: 'chat_renamed',
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_SENT: 'message_sent',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    MESSAGE_SWIPED: 'message_swiped',
    MESSAGE_SWIPE_DELETED: 'message_swipe_deleted',
    CHARACTER_FIRST_MESSAGE_SELECTED: 'character_first_message_selected',
    GENERATION_STARTED: 'generation_started',
    GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
    GENERATION_ENDED: 'generation_ended',
    GENERATION_STOPPED: 'generation_stopped',
    CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
    GENERATE_AFTER_COMBINE_PROMPTS: 'generate_after_combine_prompts',
});
export const EXTENSION_PROMPT_TYPES = Object.freeze({ NONE: -1, IN_PROMPT: 0, IN_CHAT: 1, BEFORE_PROMPT: 2 });
export const EXTENSION_PROMPT_ROLES = Object.freeze({ SYSTEM: 0, USER: 1, ASSISTANT: 2 });
export const MAIN_PROMPT = 'Write the next reply in this story.';
