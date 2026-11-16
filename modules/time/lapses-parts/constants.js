// Story Director: grace-period constants and closing reasons for lapsed records.

// Story days a beat may run late before it slips: the story gets the rest of its day and two
// more to bring it in (on-screen, or as news), then it is closed for it.
export const SLIP_GRACE_DAYS = 2;
// Story days an offer with no deadline stays open after the later of its being offered and the
// story last mentioning it (its `seen` time); then it lapses like one whose deadline passed.
// A constant, not a setting (USER, 5 Nov: "without deadline, it should expire in 2-3 game days").
export const UNDATED_OFFER_DAYS = 3;
// The reasons written on the `-` lines, and read back for the next note.
export const SLIPPED_REASON = 'slipped';
export const LAPSED_REASON = 'offer lapsed';
