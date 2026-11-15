// Patterns for pack ids, slugs, versions and event commands.

// Slugs are lowercase words joined by single dashes, as Story Block's definition IDs need.
export const PACK_ID = /^(?=.{1,40}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG = /^(?=.{1,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMVER = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:-[0-9A-Za-z.-]{1,40})?(?:\+[0-9A-Za-z.-]{1,40})?$/;
// A command an event runs: `inventory.grant`, `wallet.receive`, `quest.take` …
export const COMMAND = /^[a-z][a-z0-9-]{0,39}(?:\.[a-z][A-Za-z0-9-]{0,39}){1,3}$/;
