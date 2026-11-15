// Dropping a leading article from a name key (shared by meeting and shown-check parts).


// Story Block's present list drops a leading article ("the scout" is listed as "scout"), so an alias is matched with it too.
export const bare = key => key.replace(/^(?:the|a|an)\s+/, '');
