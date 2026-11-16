// Chronicle's rumour caps and the pattern that names who wrote a lasting entry.

// The World pulse's rumours (`rumour`: the name of the event they are about; `heard`: the story's own world line named one): at most this many
// are open, and one closes after this many story days or when its event ends.
export const RUMOUR_OPEN_MAX = 3;
export const RUMOUR_DAYS = 3;
/** Who wrote a lasting entry: the `event:<id>` caller of `chronicle.lasting` (Story Block's own pattern). */
export const LASTING_BY = /^event:[A-Za-z0-9][A-Za-z0-9._/:-]{0,119}$/;
