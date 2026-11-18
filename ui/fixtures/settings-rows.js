// Settings rows the real selectors do not have (yet): each is the mock's row with its reason and the job that retires it; tests/ui/fixtures/real-rows.test.js fails when a real row for one of them appears.

export const MOCK_ONLY = {
  // SA-TOOLS: the Prompts and Chat data groups are built (Tools draws them as its own cards, not selector rows); the Diagnostics rows stay as the mock has them.
  tools: (R) => [
    R("Diagnostics", "tools.report", "btn", "Report", null, {"hint":"Versions, packs, problems; copy it into a bug report","options":["Copy report"]}),
    R("Diagnostics", "tools.packEvents", "btn", "Pack events", null, {"options":["Show"]}),
  ],
  // A pack-supplied custom view: the live list is whatever the installed packs bring, none in a clean install.
  addons: (R) => [
    R("Custom views", "addons.wantedPosterSample", "btn", "Wanted poster (sample)", null, {"hint":"From Ersveil · shows bounties as posters · needs approval","options":["Approve","Preview"]}),
  ],
};
