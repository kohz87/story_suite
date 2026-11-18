// Settings rows the real selectors do not have (yet): each is the mock's row with its reason and the job that retires it; tests/ui/fixtures/real-rows.test.js fails when a real row for one of them appears.

export const MOCK_ONLY = {
  // SA-TOOLS (owner decision pending): the Prompts, Chat data and Diagnostics groups are not built live.
  tools: (R) => [
    R("Prompts", "tools.peopleHowFeelingsAreJudg", "btn", "People: how feelings are judged", null, {"hint":"Relationship criteria the Refresh and fill-in use","options":["Read and edit","Reset to default"]}),
    R("Prompts", "tools.peopleHowBigAMomentIs", "btn", "People: how big a moment is", null, {"hint":"Impact-tier criteria (ordinary, meaningful, major, extreme)","options":["Read and edit","Reset to default"]}),
    R("Prompts", "tools.peopleWhatIsWorthRemembe", "btn", "People: what is worth remembering", null, {"hint":"Memory criteria","options":["Read and edit","Reset to default"]}),
    R("Prompts", "tools.peopleFeelingsIntoBehavi", "btn", "People: feelings into behaviour", null, {"hint":"Behaviour rubric","options":["Read and edit","Reset to default"]}),
    R("Prompts", "tools.arcPrompt", "btn", "Arc planner prompt", null, {"hint":"What the planner is asked","options":["Read and edit","Reset to default"]}),
    R("Chat data", "tools.exportThisChatSSuiteData", "btn", "Export this chat’s suite data", null, {"options":["Export"]}),
    R("Chat data", "tools.import", "btn", "Import", null, {"options":["Import a file"]}),
    R("Chat data", "tools.rewind", "sw", "Rewind when a middle message is deleted", false),
    R("Chat data", "tools.reReadChangedBranches", "sw", "Re-read changed branches", true),
    R("Diagnostics", "tools.report", "btn", "Report", null, {"hint":"Versions, packs, problems; copy it into a bug report","options":["Copy report"]}),
    R("Diagnostics", "tools.packEvents", "btn", "Pack events", null, {"options":["Show"]}),
  ],
  // A pack-supplied custom view: the live list is whatever the installed packs bring, none in a clean install.
  addons: (R) => [
    R("Custom views", "addons.wantedPosterSample", "btn", "Wanted poster (sample)", null, {"hint":"From Ersveil · shows bounties as posters · needs approval","options":["Approve","Preview"]}),
  ],
};
