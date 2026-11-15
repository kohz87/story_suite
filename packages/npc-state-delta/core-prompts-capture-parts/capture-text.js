/* The one-pass capture header, story line and reminder text. */
export const NARRATION_CAPTURE_HEADER = `NPC STATE DELTA ONE-PASS CAPTURE. Write your complete in-character reply first, exactly as you otherwise would; nothing below changes the story, its length or its voice. Then end the message, after all story text, with one hidden block:
<!--npc_state_delta
{"npcs":[...],"profileUpdates":[...],"keyRelationshipEdges":[...]}
-->
Never mention the block in the story. Fill its JSON as this private NPC dossier scanner would for the user's latest message and your reply:`;
export const NARRATION_CAPTURE_STORY = 'Story context: the chat above. CURRENT exchange = the user\'s latest message plus the reply you are writing now; use only it for presence, live state and relationship deltas.';
// (1.2.11) The slow fields named at the end, where the model looks last: they fill only from
// evidence gathered over scenes, and a block written beside the story tended to leave them out.
export const NARRATION_CAPTURE_REMINDER = 'Reminder: after the story, end with the <!--npc_state_delta {valid JSON} --> block. Before closing it, check each NPC who acted in your reply for the slow fields, which build up over scenes: a habit or tic (profileUpdates mannerisms + evidence.mannerisms), how they decide or treat people (behaviorProfile "Label: level - effect" + evidence.behaviorProfile), a consequential event (memories: only the new one, in its npcs[] entry). Write the evidence whenever the reply shows one, even if the field itself must wait.'
    // (1.2.12) Relationships settled in the block, so no evaluator request is needed: a full row for
    // each existing NPC the reply names, and the model's own word on whether that covers everyone.
    + ' Relationships: give each existing NPC your story names an npcs row with relationshipImpact and all four relationshipDelta keys (0 = no change). Add top-level "relationshipsCovered": true when those rows hold everyone whose feelings toward the user could have changed in this reply, and list anyone you are unsure of in "relationshipReview": ["Name"].';
