// Story Suite v2: the classes and control names SillyTavern acts on, and cleaning class lists of them.

/**
 * Classes a template may not use: SillyTavern binds delegated handlers to them on the whole document
 * (`$(document).on('click', '.mes_edit', …)` edits the message the button sits in, and cards are drawn
 * inside messages) or counts and finds messages by them (`.mes`, `.last_mes`, `.mes_text`). The list:
 * message structure `mes`, `last_mes`, `mes_block`, `mes_text`, `mes_buttons`, `mes_button`, `mesAvatarWrapper`,
 * `extraMesButtonsHint`, `extraMesButtons`, `edit_textarea`, `del_checkbox`; swipes `swipe_left`, `swipe_right`,
 * `swipes-counter`, `mes_img_swipe_left`, `mes_img_swipe_right`; message actions `mes_edit`,
 * `mes_edit_done`, `mes_edit_cancel`, `mes_edit_delete`, `mes_edit_copy`, `mes_edit_up`, `mes_edit_down`,
 * `mes_edit_add_reasoning`, `mes_hide`, `mes_unhide`, `mes_bookmark`, `mes_create_bookmark`,
 * `mes_create_branch`, `mes_translate`, `mes_narrate`, `mes_prompt`, `mes_copy`, `mes_delete`, `mes_stop`,
 * `mes_reasoning_edit`, `mes_reasoning_edit_done`, `mes_reasoning_edit_cancel`, `mes_reasoning_copy`,
 * `mes_reasoning_delete`, `mes_img_enlarge`, `mes_img_delete`, `mes_file_open`, `mes_file_delete`;
 * chats and characters `select_chat_block`, `character_select`, `group_select`, `bogus_folder_select`,
 * `dragClose`. (`menu_button` is SillyTavern's button look, with no handler of its own: it stays usable.)
 */
export const RESERVED_CLASSES = Object.freeze(new Set([
    'mes', 'last_mes', 'mes_block', 'mes_text', 'mes_buttons', 'mes_button', 'mesAvatarWrapper', 'extraMesButtonsHint',
    'extraMesButtons', 'edit_textarea', 'del_checkbox',
    'swipe_left', 'swipe_right', 'swipes-counter', 'mes_img_swipe_left', 'mes_img_swipe_right',
    'mes_edit', 'mes_edit_done', 'mes_edit_cancel', 'mes_edit_delete', 'mes_edit_copy', 'mes_edit_up', 'mes_edit_down',
    'mes_edit_add_reasoning', 'mes_hide', 'mes_unhide', 'mes_bookmark', 'mes_create_bookmark', 'mes_create_branch',
    'mes_translate', 'mes_narrate', 'mes_prompt', 'mes_copy', 'mes_delete', 'mes_stop', 'mes_reasoning_edit',
    'mes_reasoning_edit_done', 'mes_reasoning_edit_cancel', 'mes_reasoning_copy', 'mes_reasoning_delete',
    'mes_img_enlarge', 'mes_img_delete', 'mes_file_open', 'mes_file_delete',
    'select_chat_block', 'character_select', 'group_select', 'bogus_folder_select', 'dragClose',
]));
/**
 * Control names of SillyTavern 1.19's own radio groups (read with `input[name="…"]:checked`): a template radio
 * with one of these names outside a form would join SillyTavern's group. `avatar_style` and `chat_display`
 * (select ids in 1.19, radio names in older versions) are kept; they cost nothing.
 */
export const RESERVED_NAMES = Object.freeze(new Set([
    'character_names', 'continue_postfix', 'extension_default_position', 'extension_floating_char_position',
    'extension_floating_position', 'avatar_style', 'chat_display',
]));

/** A class list without the reserved classes: `{ value, dropped }`. */
export function cleanClasses(value) {
    const kept = [];
    const dropped = [];
    for (const name of String(value ?? '').split(/\s+/).filter(Boolean)) (RESERVED_CLASSES.has(name) ? dropped : kept).push(name);
    return { value: kept.join(' '), dropped };
}

/** True when `name` may be a class a template sets (data-class, bound class lists). */
export const classAllowed = name => !RESERVED_CLASSES.has(String(name));
