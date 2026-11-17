import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildScannerPrompt,
    buildBackfillPrompt,
    buildDossierImportPrompt,
    buildProfileRefreshPrompt,
    createNpcRecord,
    selectScannerContextNpcs,
} from '../../modules/people/core/core.js';

test('scanner prompt exposes durable Key Relationships and stable profile context', () => {
    const npc = createNpcRecord('Marris');
    npc.keyRelationships = ['Elena — older sister | protective but blunt'];
    const prompt = buildScannerPrompt({ transcript: 'Marris and Elena finally reconcile after years apart.', existingNpcs: [npc] });
    assert.match(prompt, /DURABLE PROFILE CHANNEL/i);
    assert.match(prompt, /ALWAYS top-level keyRelationshipEdges/i);
    assert.match(prompt, /new grounded durable profile facts count as changes/i);
    assert.match(prompt, /aId,a,bId,b,aToB=b's role to a,bToA/i);
    assert.match(prompt, /social change[\s\S]*?evolve/i);
    assert.match(prompt, /"keyRelationships":\["Elena — older sister \| protective but blunt"\]/);
});

test('pronoun-only current exchange still supplies one recent stable profile for durable evaluation', () => {
    const npc = createNpcRecord('Marris');
    npc.present = true; npc.lastSeenTurn = 8; npc.personality = 'Reserved.'; npc.speech = 'Soft and formal.';
    const prompt = buildScannerPrompt({
        transcript: 'She folds her hands, addresses the elder as Sir, and makes the request with careful courtesy.',
        existingNpcs: [npc],
    });
    assert.match(prompt, /"name":"Marris"/);
    assert.match(prompt, /"speech":"Soft and formal\."/);
});

test('explicit dossier import maps Megumin Inner Circle without manufacturing player relationship scores', () => {
    const npc = createNpcRecord('Luna');
    const prompt = buildDossierImportPrompt({
        targetName: 'Luna',
        existingNpc: npc,
        userName: 'Aris',
        charName: 'Megumin',
        dossierText: `<New_NPC name="Luna">\n**Age:** 24\n**Voice:** clipped and formal\n**Inner Circle:**\n* Mara — younger sister | fiercely protective\n* Dain — old rival | grudging respect\n**Read on the PC:** Wary but curious\n</New_NPC>`,
    });
    assert.match(prompt, /Inner Circle \/ family \/ close allies \/ rivals \/ mentors \/ partners => keyRelationships/i);
    assert.match(prompt, /Never invent numeric Trust\/Affection\/Desire\/Tension/i);
    assert.match(prompt, /Where to Find Them.*NOT current Location/i);
    // (cleanup step 13) The rule keeps every delta at 0 and the return shape no longer asks for the
    // numbers: the targeted pass zeroes them in code.
    assert.match(prompt, /relationshipImpact="none" and every relationshipDelta key MUST be 0/);
    assert.doesNotMatch(prompt.slice(prompt.indexOf('Return shape')), /relationshipDelta/);
});

test('scanner prompt defines appearance as durable image-ready detail with refine/change lifecycle', () => {
    const npc = createNpcRecord('Selene');
    npc.appearance = 'Young woman with dark hair.';
    const prompt = buildScannerPrompt({
        transcript: "Later, the narration clearly reveals Selene's amber eyes, olive skin, slim build, and the faint scar under her left eye. Years later, she cuts her hair to her shoulders.",
        existingNpcs: [npc],
    });
    assert.match(prompt, /DURABLE PROFILE CHANNEL/i);
    assert.match(prompt, /matching \*State:"refine"/i);
    assert.match(prompt, /clothes\/form\/presentation change=>appearanceState:"change"\+reason/i);
    assert.match(prompt, /fleeting pose\/expression is not identity/i);
    assert.match(prompt, /"appearance":"Young woman with dark hair\."/);
});

test('scanner prompt defines speech and mannerisms as evolving durable identity rather than append-only observations', () => {
    const npc = createNpcRecord('Marris');
    npc.speech = 'Soft-spoken and hesitant.';
    npc.mannerisms = ['Avoids eye contact.', 'Twists her sleeves when nervous.'];
    const prompt = buildScannerPrompt({
        transcript: 'Years later, Marris now gives calm direct orders and consistently holds eye contact when making decisions.',
        existingNpcs: [npc],
    });
    assert.match(prompt, /profileUpdates/i);
    assert.match(prompt, /matching \*State:"refine"/i);
    assert.match(prompt, /personality\/speech\/mannerism\/behaviorProfile "evolve"\+reason/i);
    assert.match(prompt, /mannerisms FULL max4/i);
    assert.match(prompt, /social change[\s\S]*?omission NEVER erases/i);
    assert.match(prompt, /DURABLE PROFILE CHANNEL/i);
    assert.match(prompt, /"speech":"Soft-spoken and hesitant\."/);
    assert.match(prompt, /"mannerisms":\["Avoids eye contact\.","Twists her sleeves when nervous\."\]/);
});

test('scanner prompt defines personality as gradual durable development rather than transient emotion', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Shy and approval-seeking.';
    const prompt = buildScannerPrompt({
        transcript: 'Five years later, Marris is older. She calmly refuses her sister\'s order and makes the decision herself, as she has throughout the past year.',
        existingNpcs: [npc],
    });
    assert.match(prompt, /DURABLE PROFILE CHANNEL/i);
    assert.match(prompt, /profileUpdates/i);
    assert.match(prompt, /matching \*State:"refine"/i);
    assert.match(prompt, /personality\/speech\/mannerism\/behaviorProfile "evolve"\+reason/i);
    assert.match(prompt, /time skip alone invents nothing/i);
        assert.match(prompt, /"personality":"Shy and approval-seeking\."/);
});

test('scanner exposes age for every relevant NPC and defines automatic age/apparent-age evolution contract', () => {
    const myla = createNpcRecord('Myla'); myla.id = 'npc_myla'; myla.age = '20'; myla.apparentAge = '~20';
    const toris = createNpcRecord('Toris'); toris.id = 'npc_toris'; toris.age = '43'; toris.apparentAge = '~45';
    const luna = createNpcRecord('Luna'); luna.id = 'npc_luna'; luna.age = '15'; luna.apparentAge = '~15';
    const prompt = buildScannerPrompt({
        transcript: 'Myla and Toris remember Luna at fifteen. Three years later, Luna returns visibly older and now looks about eighteen.',
        existingNpcs: [myla, toris, luna],
    });
    assert.match(prompt, /Age\/ApparentAge separate/i);
    assert.match(prompt, /ageState:"advance"/i);
    assert.match(prompt, /ageState:"correct"/i);
    assert.match(prompt, /apparentAgeState:"evolve"/i);
    assert.match(prompt, /ageState:"advance"/i);
    assert.match(prompt, /no species-aging inference/i);
    assert.match(prompt, /"age":"15"/);
    assert.match(prompt, /"apparentAge":"~15"/);
    assert.match(prompt, /ageState:"advance"\+reason/i);
    assert.match(prompt, /apparentAgeState:"evolve"\+reason/i);
});

test('scanner prompt separates chronological/apparent age and requests grounded prompt-ready appearance', () => {
    const npc = createNpcRecord('Yunyun');
    npc.age = '18';
    npc.apparentAge = '~18';
    npc.appearance = 'Young woman with long dark brown hair, crimson eyes, a slim build, and a black-and-red adventurer outfit.';
    const prompt = buildScannerPrompt({ transcript: 'Yunyun changes into a formal crimson dress.', existingNpcs: [npc], userName: 'Kazuma', charName: 'Megumin' });
    assert.match(prompt, /age=chronology only/i);
    assert.match(prompt, /apparentAge=visual cue/i);
    assert.match(prompt, /species literal/i);
    assert.match(prompt, /DURABLE PROFILE CHANNEL/i);
    assert.match(prompt, /vague time skip insufficient/i);
    assert.match(prompt, /Stable profile context/i);
    assert.match(prompt, /"age":"18"/);
    assert.match(prompt, /"apparentAge":"~18"/);
    assert.match(prompt, /long dark brown hair/);
});

test('scanner prompt uses compact identity index, changed-only output, delta relationships, and player tuning', () => {
    const prompt = buildScannerPrompt({
        transcript: 'Yunyun: Hello', existingNpcs: [], userName: 'Kazuma', charName: 'Megumin', maxNpcs: 5,
        relationshipBaseline: { trust: 40, affection: 10, desire: 2, tension: 5 },
        relationshipCaps: { ordinary: 2, meaningful: 6, major: 12, extreme: 20 },
        relationshipCriteria: 'CUSTOM TRUST RULE', impactCriteria: 'CUSTOM IMPACT RULE', memoryCriteria: 'CUSTOM MEMORY RULE',
    });
    assert.match(prompt, /Exclude player \(Kazuma\)/);
    assert.match(prompt, /main speaker \(Megumin\)/);
    assert.match(prompt, /Return ONLY observed\/new\/meaningfully changed NPCs/i);
    assert.match(prompt, /Identity index \(matching only\)/i);
    assert.match(prompt, /include name,identityKind,dossierSignal/i);
    assert.match(prompt, /include name,identityKind,dossierSignal/i);
    assert.match(prompt, /directInteraction affects admission\/relationship only/i);
    assert.match(prompt, /First-seen role_label ALWAYS stays candidate/i);
    assert.match(prompt, /regardless of dossierSignal\/directInteraction/i);
    assert.match(prompt, /sameIndividual=true only when/i);
    assert.match(prompt, /Identity promotion: role\/interim dossier \+ grounded proper name/i);
    assert.match(prompt, /MUST reuse id/i);
    assert.match(prompt, /old label in aliases/i);
    assert.match(prompt, /never duplicate\/downgrade/i);
    assert.match(prompt, /EVERY non-zero axis needs grounded evidence from the CURRENT exchange/i);
    assert.match(prompt, /-100\.\.\+100/i);
    assert.match(prompt, /continuation\/aftermath=>0/i);
    assert.match(prompt, /CUSTOM TRUST RULE/);
    assert.match(prompt, /CUSTOM IMPACT RULE/);
    assert.match(prompt, /CUSTOM MEMORY RULE/);
    assert.doesNotMatch(prompt, /"respect"/);
});

test('scanner prompt exposes admission modes while manual backfill uses a dedicated targeted extractor', () => {
    const conservative = buildScannerPrompt({ transcript: 'A guard takes two copper.', admissionMode: 'conservative' });
    assert.match(conservative, /CONSERVATIVE:/);
    assert.match(conservative, /first-seen role_label ALWAYS stays candidate/i);
    assert.match(conservative, /same-person recurrence/i);
    assert.match(conservative, /World State, durable Inner Chatter.*Proper names there MUST be returned/i);
    const balanced = buildScannerPrompt({ transcript: 'The receptionist answers.', admissionMode: 'balanced' });
    assert.match(balanced, /BALANCED:/);
    assert.match(balanced, /direct two-way player interaction/);
    const manual = buildScannerPrompt({ transcript: 'Marris waves.', admissionMode: 'manual_only' });
    assert.match(manual, /MANUAL ONLY:/);

    const existing = createNpcRecord('Toris');
    const backfill = buildBackfillPrompt({
        transcript: 'World State: Toris (Receptionist): working the desk. NPC Inner Chatter: Toris: More forms.',
        targetName: 'Toris',
        existingNpc: existing,
        userName: 'Aris',
        charName: 'Narrator',
        memoryCriteria: 'BACKFILL MEMORY RULE: keep durable promises; reject routine service.',
    });
    assert.match(backfill, /targeted dossier backfill extractor/i);
    assert.match(backfill, /player EXPLICITLY chose to keep one NPC/i);
    assert.match(backfill, /Requested NPC: Toris/);
    assert.match(backfill, /RETURN EXACTLY ONE NPC object/i);
    assert.match(backfill, /PRESENT is current-scene state/i);
    assert.match(backfill, /MOST RECENT ASSISTANT STORY MESSAGE/i);
    assert.match(backfill, /relationshipImpact MUST be "none"/i);
    assert.match(backfill, /Keep the JSON compact enough to finish reliably/i);
    assert.match(backfill, /Finish and close every quoted string/i);
    assert.match(backfill, /Memory criteria:/i);
    assert.match(backfill, /BACKFILL MEMORY RULE/);
    assert.match(backfill, /Important Memories are capped at 5/i);
    assert.match(backfill, /memoryRetention/i);
    assert.match(backfill, /most consequential\/durable/i);
    assert.doesNotMatch(backfill, /CONSERVATIVE:|Impact-tier criteria configured by player/);
});

test('scanner context includes mentioned/recent NPC details but not the whole roster payload', () => {
    const roster = Array.from({ length: 40 }, (_, i) => {
        const npc = createNpcRecord(`NPC ${i + 1}`);
        npc.appearance = `UNIQUE_VISUAL_${i + 1}_` + 'x'.repeat(700);
        npc.lastSeenTurn = i;
        return npc;
    });
    roster[4].name = 'Marris';
    roster[4].appearance = 'MARRIS_VISUAL dark hair and ink-stained apron.';
    const selected = selectScannerContextNpcs(roster, 'Marris hands Aris the registration form.', 6);
    assert.ok(selected.some(npc => npc.name === 'Marris'));
    const prompt = buildScannerPrompt({ transcript: 'Marris hands Aris the registration form.', existingNpcs: roster });
    assert.match(prompt, /MARRIS_VISUAL/);
    assert.doesNotMatch(prompt, /UNIQUE_VISUAL_1_/);
    assert.ok(prompt.length < 11500 + 127, `scanner prompt should stay compact with the approved background rule (+127), got ${prompt.length} chars`);
});

test('scanner treats status mood goal and location as actively reassessed live state and exposes stored values beyond profile tier', () => {
    const myla = createNpcRecord('Myla'); myla.id = 'npc_myla'; myla.mood = 'Anxious'; myla.location = 'Guildhall';
    const toris = createNpcRecord('Toris'); toris.id = 'npc_toris'; toris.mood = 'Watchful'; toris.location = 'Front gate';
    const luna = createNpcRecord('Luna'); luna.id = 'npc_luna'; luna.mood = 'Relieved'; luna.location = 'Infirmary';
    const prompt = buildScannerPrompt({
        transcript: 'Myla speaks to Toris while Luna leaves the infirmary for an unknown destination.',
        existingNpcs: [myla, toris, luna],
    });
    assert.match(prompt, /Goal\/status\/mood\/location are LIVE/i);
    assert.match(prompt, /actively reassess each returned EXISTING NPC every scan/i);
    assert.match(prompt, /locationState:"clear"/i);
    assert.match(prompt, /Off-screen\/no evidence alone never clears it/i);
    assert.match(prompt, /"mood":"Relieved"/);
    assert.match(prompt, /"location":"Infirmary"/);
});

test('full-window scanner reconciles history while isolating live state and relationship deltas to current exchange', () => {
    const luna = createNpcRecord('Luna');
    luna.id = 'npc_luna';
    luna.personality = 'Reserved and courteous.';
    luna.speech = 'Soft and formal.';
    const prompt = buildScannerPrompt({
        transcript: 'Earlier: Luna reveals that she is fiercely competitive.\nLater: Luna consistently addresses elders by title.\nCurrent: Luna quietly greets the player.',
        currentTranscript: 'Current: Luna quietly greets the player.',
        existingNpcs: [luna],
        fullScanMode: true,
    });
    assert.match(prompt, /FULL-WINDOW RECONCILIATION/);
    assert.match(prompt, /recover missed durable facts/);
    assert.match(prompt, /Numeric relationshipImpact\/relationshipDelta MUST use only CURRENT exchange/);
    assert.match(prompt, /anywhere in the supplied recent-history window/);
    assert.match(prompt, /CURRENT exchange \(authoritative for presence, mood and location\):\nCurrent: Luna quietly greets the player/);
});

test('scanner exposes stored status for every relevant NPC and provides an explicit status clear contract', () => {
    const myla = createNpcRecord('Myla');
    myla.id = 'npc_myla';
    myla.status = 'Recovering from a broken arm';
    const toris = createNpcRecord('Toris');
    toris.id = 'npc_toris';
    toris.status = 'Keeping watch at the guild door';
    const luna = createNpcRecord('Luna');
    luna.id = 'npc_luna';
    luna.status = 'Waiting for the physician';

    const prompt = buildScannerPrompt({
        transcript: 'Myla greets Toris while Luna says the physician has arrived and she no longer needs to wait.',
        existingNpcs: [myla, toris, luna],
        admissionMode: 'conservative',
    });
    assert.match(prompt, /Goal\/status\/mood\/location are LIVE/i);
    assert.match(prompt, /matching \*State:"clear"/i);
    assert.match(prompt, /"status":"Waiting for the physician"/);
    assert.match(prompt, /status,statusState/i);
    assert.match(prompt, /lifeState unknown\|alive\|deceased/i);
});

test('scanner prompt explicitly evaluates existing goal lifecycle and exposes current goals in live context', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    npc.goal = 'Reach the capital';
    const prompt = buildScannerPrompt({
        transcript: 'Myla steps through the capital gates and says the journey is finally over.',
        existingNpcs: [npc],
        admissionMode: 'conservative',
    });
    assert.match(prompt, /Goal\/status\/mood\/location are LIVE/i);
    assert.match(prompt, /goalState/i);
    assert.match(prompt, /Unchanged -> omit/i);
    assert.match(prompt, /"goal":"Reach the capital"/);
    assert.match(prompt, /Never use "Unknown"/i);
});

test('routine scanner prompt has bounded overhead and delta/profile tiers', () => {
    const toris = createNpcRecord('Toris Vance');
    toris.id = 'npc_toris';
    toris.role = 'Former adventurer / Guild patron';
    toris.appearance = 'Broad grizzled man in worn leather armor with a scar along his neck.';
    toris.background = 'Former adventurer who now watches the Bluewatch guildhall.';
    toris.relationshipSummary = 'Cautiously reassessing the player.';
    toris.relationship.tension = -4;
    const myla = createNpcRecord('Myla Fenn');
    myla.id = 'npc_myla';
    myla.role = 'Adventurer Guild Receptionist';
    myla.appearance = 'Young woman in a faded linen blouse and practical skirt.';
    myla.background = 'Bluewatch guild receptionist under pressure from the Guildmaster.';
    myla.relationshipSummary = 'Terrified and guilt-ridden.';
    myla.relationship.tension = 6;
    const transcript = `Aris: I ask Myla to step into the alley.\nNarrator: ${'Myla trembles and explains the quota system while begging Aris to keep the tags secret. '.repeat(22)} World State: NPCs Present: Myla Fenn, terrified in the alley. Off-Screen: Toris Vance waits by the hearth. NPC Inner Chatter: Myla Fenn fears Aris.`;
    const prompt = buildScannerPrompt({ transcript, existingNpcs: [toris, myla], userName: 'Aris', charName: 'Narrator' });
    const overhead = prompt.length - transcript.length;
    // 1.0.99 adds the user-authorized "if no named forms" qualifier to the Appearance rule; cleanup
    // Owner-approved profile style line (~350 chars) added to the routine scanner prompt.
    // step 12 the caps sentence at the stored limits (a few characters more).
    assert.ok(overhead < 8350 + 127, `routine scanner overhead includes the approved background rule (+127 chars), got ${overhead}`);
    assert.match(prompt, /Return compact JSON deltas/i);
    assert.match(prompt, /Existing relationship delta example/i);
    assert.match(prompt, /Relevant live context \(dynamic fields only\)/i);
    assert.match(prompt, /Stable profile context/i);
    assert.match(prompt, /npc_myla/);
});

test('scanner identity index includes lightweight candidates without full dossier payload', () => {
    const prompt = buildScannerPrompt({
        transcript: 'The same guild boy runs over again.',
        existingNpcs: [],
        candidates: [{ name: 'Guild Boy', identityKind: 'role_label', dossierSignal: 'incidental', role: 'Guild Apprentice', location: 'Side Dock', seenCount: 1, firstSeenTurn: 3, lastSeenTurn: 3 }],
    });
    assert.match(prompt, /\"registryState\":\"candidate\"/);
    assert.match(prompt, /Guild Boy/);
    assert.match(prompt, /"role":"Guild Apprentice"/);
    assert.match(prompt, /"location":"Side Dock"/);
    assert.match(prompt, /"lastSeenTurn":3/);
    assert.match(prompt, /\"seenCount\":1/);
});

test('scanner prompt distinguishes scene presence, World State, and NPC Inner Chatter', () => {
    const prompt = buildScannerPrompt({ transcript: 'World State: Yunyun trains outside Axel. NPC Inner Chatter: Wiz worries about Kazuma.' });
    assert.match(prompt, /worldActive=true only explicit current off-screen activity/i);
    assert.match(prompt, /Inner Chatter supports durable facts/i);
    assert.match(prompt, /not transient monologue/i);
    assert.match(prompt, /World State\/Inner Chatter alone never presence/i);
});

test('targeted Refresh from Chat prompt reconciles one dossier without replaying relationship stats or presence', () => {
    const prompt = buildProfileRefreshPrompt({
        transcript: 'Kazuma: How are you?\nLuna: She answers with careful honorifics and says she now works in the archive.',
        targetNpc: {
            id: 'npc_luna', name: 'Luna', personality: 'Reserved.', speech: 'Formal.',
            relationship: { trust: 14, affection: 5, desire: 0, tension: -2 },
            present: true, manualProfileFields: ['appearance'], memories: ['Old promise.'],
        },
        userName: 'Kazuma', charName: 'Megumin', memoryCriteria: 'Only durable events.',
    });
    assert.match(prompt, /TARGETED REFRESH FROM CHAT/);
    assert.match(prompt, /exactly one EXISTING NPC/i);
    assert.match(prompt, /currentRelationship is READ-ONLY/i);
    assert.match(prompt, /every relationshipDelta 0/i);
    assert.match(prompt, /present\/worldActive.*ignored/i);
    assert.match(prompt, /lockedProfileFields/);
    assert.match(prompt, /profileUpdates/);
    assert.match(prompt, /do not return keyRelationshipEdges/);
    assert.doesNotMatch(prompt, /,"keyRelationshipEdges":\[\]/, 'NSD11: no edges in the return shape');
    assert.match(prompt, /Latest grounded evidence wins/i);
});

test('v0.2.5 scanner and targeted refresh enforce identity firewall and developmental time-skip semantics', () => {
    const npc = createNpcRecord('Falia');
    npc.personality = 'Kind-hearted, restrained, and pragmatic.';
    npc.behaviorProfile = ['Disposition: Broadly kind; avoids needless suffering.', 'Expressiveness: Low.'];
    const scanner = buildScannerPrompt({ transcript: 'Falia quietly helps a wounded stranger, then speaks privately with the player.', existingNpcs: [npc] });
    assert.match(scanner, /IDENTITY FIREWALL/i);
    assert.match(scanner, /relationship-specific behavior never becomes global/i);
    assert.match(scanner, /Kindness stays general/i);
    assert.match(scanner, /necessary force != cruelty/i);
    assert.match(scanner, /behaviorProfile FULL max6/i);
    assert.match(scanner, /developmentScale=gradual\|explicit\|batch/i);
    assert.match(scanner, /time skip alone invents nothing/i);

    const refresh = buildProfileRefreshPrompt({ transcript: 'Six months pass while Falia remains active in the guard.', targetNpc: npc, userName: 'Aris' });
    assert.match(refresh, /behaviour unique to Aris never becomes global/i);
    assert.match(refresh, /Mere passage of time does nothing/i);
});
