// The words of story-spec ui. Every state word, finding sentence, heading and action label the page shows comes from
// this one table, so the page reads in plain sentences and a word changed here changes everywhere on it. IDs,
// versions, rule names and hashes never go in these words: they go on an item's details line. Templates fill `{name}`
// from their values, and `{n|story}` with a count and the noun's singular or plural (see say() in route.ts). Exported,
// so the CLI could speak the same words later.

/** What a story or scenario is, in the page's words. */
export type StateKey = 'can-do-today' | 'being-built' | 'planned' | 'needs-a-look' | 'waiting-on-you' | 'checked' | 'failed-a-check'

/** The trace's status a state word stands for. A story's is its status in `story-spec trace --json` (`rows[].status`);
 * a scenario's is worked out from its row the way TRACE.md marks it (see scenarioStatus in view.ts). */
export type TraceStatus =
  | 'done' | 'in-progress' | 'draft' | 'ready'
  | 'proven' | 'failed' | 'stale' | 'no-test' | 'not-run' | 'awaiting-run' | 'blocked' | 'awaiting-person'

export type Module = 'model' | 'implementation' | 'proof'
export type ScreenKey = 'people' | 'stories' | 'decisions' | 'records' | 'words' | 'code' | 'ports' | 'layers' | 'by-tests' | 'by-a-run' | 'by-a-person' | 'stale'
/** What an action does on the page; an action with no op is a sentence saying what to do outside it. */
export type ActionOp = 'decide' | 'approve' | 'start' | 'check' | 'check-again' | 'claim' | 'add-persona' | 'start-story' | 'add-scenario'
export type FindingWords = { module: Module; screen: ScreenKey; sentence: string; action: string; op?: ActionOp }

export const VOCABULARY = {
  states: {
    'can-do-today': { word: 'can do today', of: 'story', trace: ['done'] },
    'being-built': { word: 'being built', of: 'story', trace: ['in-progress'] },
    planned: { word: 'planned', of: 'story', trace: ['draft', 'ready'] },
    checked: { word: 'checked', of: 'scenario', trace: ['proven'] },
    'failed-a-check': { word: 'failed a check', of: 'scenario', trace: ['failed'] },
    'needs-a-look': { word: 'needs a look', of: 'scenario', trace: ['stale', 'no-test', 'not-run', 'awaiting-run'] },
    'waiting-on-you': { word: 'waiting on you', of: 'scenario', trace: ['blocked', 'awaiting-person'] },
  } satisfies Record<StateKey, { word: string; of: 'story' | 'scenario'; trace: TraceStatus[] }>,

  // Why a thing is in its state: one short template per trace status, filled with the items, never free text.
  why: {
    done: 'All {n|scenario} are checked, {tiers}.',
    'in-progress': '{proven} of {n|scenario} are checked. Still to go:',
    'in-progress-empty': 'It has no scenarios yet, so nothing can prove it. Write its scenarios.',
    draft: 'It is a draft: nobody has approved its scenarios yet.',
    ready: 'Its scenarios are approved, and nobody has started building it.',
    proven: 'Checked {tiers}.',
    'proven-person': '{by} checked it on {date}.',
    'proven-run': 'The {tier} run proved it on {date}.',
    failed: 'Its test fails. Fix the code or the test.',
    'failed-person': '{by} found it failing on {date}.',
    'failed-run': 'The {tier} run failed it on {date}.',
    stale: '{by} checked it on {date}, but its text has changed since, so the check no longer counts.',
    'stale-run': 'The {tier} run proved it on {date}, but its text has changed since, so the proof no longer counts.',
    'stale-unknown': 'The text it was checked against isn\'t in git history.',
    'no-test': 'No test checks it yet.',
    'not-run': 'Its test hasn\'t run yet.',
    'awaiting-run': 'The {tier} run hasn\'t proved it yet.',
    blocked: 'It waits on the decision "{question}", which {owner} answers.',
    'blocked-nobody': 'It waits on the decision "{question}", and nobody is named to answer it.',
    'awaiting-person': 'Nobody has checked it by hand yet.',
    note: 'Their note: {note}',
    then: 'Then',
    now: 'Now',
  },

  tiers: { local: 'by tests', manual: 'by a person', other: 'by the {tier} run', and: ' and ' },

  // What would change a state, or answer a finding. Labels for buttons, or sentences when the page can't do it.
  actions: {
    decide: 'Decide',
    answer: 'Answer',
    approve: 'Approve',
    start: 'Start building',
    check: 'Check',
    'check-again': 'Check again',
    claim: 'Claim',
    'add-persona': 'Add a persona',
    'start-story': 'Start a story',
    'add-scenario': 'Add a scenario',
    'write-test': 'Write its test',
    'run-tests': 'Run the tests: story-spec trace',
    'run-tier': 'Run it again: story-spec trace --tier {tier}',
    fix: 'Fix the code or the test',
    holds: 'It holds',
    fails: 'It fails',
  },

  nav: {
    inbox: 'Needs you',
    groups: [
      { key: 'model', label: 'Model', caption: 'what should be', screens: ['people', 'stories', 'decisions', 'records', 'words'] },
      { key: 'implementation', label: 'Implementation', caption: 'what is', screens: ['code', 'ports', 'layers'] },
      { key: 'proof', label: 'Proof', caption: 'how we know', screens: ['by-tests', 'by-a-run', 'by-a-person', 'stale'] },
    ] as { key: Module; label: string; caption: string; screens: ScreenKey[] }[],
    screens: {
      people: 'People', stories: 'Stories', decisions: 'Decisions', records: 'Records', words: 'Words',
      code: 'Code', ports: 'Ports', layers: 'Layers',
      'by-tests': 'By tests', 'by-a-run': 'By a run', 'by-a-person': 'By a person', stale: 'Stale',
    } satisfies Record<ScreenKey, string>,
  },

  // Each screen's heading and what it says when it has nothing to show.
  screens: {
    inbox: { heading: 'Needs you', empty: 'Nothing is waiting on you.', intro: 'Everything waiting on a person, with its action.' },
    people: { heading: 'People', empty: 'This project has no personas yet.', intro: 'The people this product serves, and what each can do.' },
    stories: { heading: 'Stories', empty: 'This project has no stories yet.', intro: 'What the product does, one line per story. Open one to read its scenarios.', retired: '{n|retired story} not shown.' },
    decisions: { heading: 'Decisions', empty: 'This project records no decisions.', intro: 'The judgement calls the scenarios don\'t pin, and the ones still waiting on an answer.' },
    records: { heading: 'Records', empty: 'This project names no records yet.', intro: 'Things that move through states, and the stories that move them.' },
    words: { heading: 'Words', empty: 'This project has no shared vocabulary yet.', intro: 'The words this project uses, as its stories folder writes them down.' },
    code: { heading: 'Code', empty: 'No story names its code yet.', intro: 'Which code each story is built in, and code no story claims.', unclaimed: 'Code no story claims' },
    ports: { heading: 'Ports', empty: 'This project has no ports.', intro: 'The outside things stories depend on, their adapters, and the tests that exercise them.', noAdapter: 'no adapter yet', noTests: 'no test exercises it' },
    layers: { heading: 'Layers', empty: 'This project sets no layer rules.', intro: 'Which code may use which, and where it doesn\'t hold.', wiring: 'Only these files may call stories' },
    'by-tests': { heading: 'By tests', empty: 'No scenario is proven by tests.', intro: 'Scenarios a test checks on every run.' },
    'by-a-run': { heading: 'By a run', empty: 'No scenario needs a run against real infrastructure.', intro: 'Scenarios a run against real infrastructure proves, recorded when it ran.' },
    'by-a-person': { heading: 'By a person', empty: 'No scenario needs a person to check it.', intro: 'Scenarios a person checks by hand. Recording a check here is the same as story-spec prove.', pending: 'Still to check', done: 'Checked' },
    stale: { heading: 'Stale', empty: 'No proof is stale.', intro: 'Proofs of text that has changed since, which no longer count.' },
  },

  // What waits on a person, as Needs you lists it.
  inbox: {
    decide: 'Waits on {owner}.',
    'decide-nobody': 'Nobody is named to answer it.',
    blocks: 'It holds up {n|scenario}.',
    approve: 'A draft: approve it when its scenarios say what it should do.',
    'check-again': 'Its text changed since it was checked.',
    check: 'Nobody has checked it by hand yet.',
    claim: 'No story claims this code.',
  },

  home: {
    stories: '{n|story}',
    // {doneWord} and {buildingWord} are the state words above, so the home says what the stories say.
    persona: '{name}: {done} {doneWord}, {building} {buildingWord}',
    beingBuilt: '{n|story} {buildingWord}',
    decisions: '{n|decision} waiting on an answer',
    model: '{stories|story}, {decisions|open decision}, {people|persona}',
    implementation: '{claimed|file} claimed by stories, {unclaimed|file} unclaimed, {ports|port}',
    proof: '{checked} of {n|scenario} checked, {stale} stale',
  },

  // A story's line: how its scenarios are proven. Parts with nothing in them are left out.
  summary: { tests: '{n} by tests', run: '{n} by a run', person: '{n} by a person', look: '{n} need a look', none: 'no scenarios yet', join: ' · ' },

  check: {
    heading: 'Check "{title}"',
    intro: 'Try it as the steps say, then record what you saw. It is written to the stories folder\'s PROOF.json, as story-spec prove would.',
    note: 'A note (optional): what you checked, and where',
    by: 'Recorded as {by}.',
    byNobody: 'Git doesn\'t know your name, so the check names nobody.',
  },
  claim: { heading: 'Claim {file}', intro: 'Adds the file to the story\'s list of the files that implement it. The code itself isn\'t changed.', story: 'The story it belongs to', pick: 'Pick the story first.' },

  // The forms that edit the files, each shown with its change before it is saved.
  sheets: {
    inFile: 'In {file}',
    waitingOnThis: 'Waiting on this',
    pinnedBy: 'Pinned by',
    answerLabel: 'The answer, as it should read in the spec',
    pinned: 'Pinned',
    pinnedHelp: 'Every implementation must keep it; the scenarios waiting on it prove it ({n}).',
    pinNeedsScenario: 'A pin needs a scenario that proves it. Add one to the story first.',
    free: 'Free',
    freeHelp: 'Any reasonable answer will do; the spec records this one.',
    draftNote: 'A draft: saving doesn\'t change its version.',
    revisionNote: 'An approved story: saving makes it a new version, with a line saying what changed.',
    scenarioTitle: 'Title',
    scenarioSteps: 'Steps, one per line, each starting GIVEN, WHEN, THEN or AND',
    writes: 'Writes {file}.',
    addScenario: 'Add a scenario',
    editScenario: 'Edit “{title}”',
    giveTitle: 'Give it a title.',
    addSteps: 'Add its steps.',
    badStep: '“{step}” should start with GIVEN, WHEN, THEN or AND.',
    needsThen: 'A scenario needs a THEN: what a test can check.',
    noChange: 'No changes yet.',
    add: 'Add',
    personaHeading: 'Add a persona',
    personaIntro: 'Appends to {file}.',
    personaIntroNew: 'Creates {file}.',
    personaName: 'Name, as the heading reads (stories name it lower-cased, with hyphens)',
    personaProse: 'Who they are and what they want, in a line',
    personaNoName: 'Give them a name.',
    personaHash: 'A name can\'t contain #.',
    personaTaken: 'The people list already describes {name}.',
    personaNoProse: 'Say in a line who they are.',
    startHeading: 'Start a story for {name}',
    startIntro: 'Creates a draft story for {name}; write its scenarios next.',
    startTitle: 'Title: what {name} can do',
    epic: 'Epic',
    start: 'Start the story',
  },

  decisions: {
    pinned: 'Every implementation must keep it; its scenarios prove it ({n}).',
    free: 'Any reasonable answer would do; this is the one chosen.',
    answered: 'Answered',
    waiting: 'Waiting on an answer',
    waitingOn: 'Waiting on {name}',
    unassigned: 'Nobody named',
    unassignedIntro: 'Open decisions that don\'t say who answers them. Write (open: <persona>) instead of (open) to put one on a persona\'s list.',
    noneWaiting: 'No open decision waits on them. Write (open: {key}) in a decision to ask them.',
  },
  people: {
    noStories: 'no stories yet',
    noProse: 'The people list says nothing about them yet.',
    waiting: '{n} waiting',
    waitingOnThem: 'Waiting on them',
  },
  records: {
    start: 'start', createdBy: 'created by {stories}', noStory: 'no story moves it here', startsNothing: 'starts nothing', nothing: 'nothing',
    arrows: 'Each arrow is a transition, labelled with the stories that move a record into its target state.',
  },

  // The grid every screen is drawn with (screens.ts): its column headings, and what it says around its rows.
  columns: {
    kind: 'Kind', what: 'What', who: 'Who', since: 'Since', state: 'State', action: 'Action',
    persona: 'Persona', story: 'Story', scenario: 'Scenario', decision: 'Decision', record: 'Record', file: 'File', port: 'Port', layer: 'Layer',
    summary: 'Proof', files: 'Files', adapters: 'Adapters', tests: 'Tests', exercised: 'Exercised in', may: 'May use', states: 'States',
    recordState: 'State', event: 'Event', enteredBy: 'Entered by', starts: 'Starts', next: 'Next',
  },
  grid: {
    all: 'All',
    toFix: 'To fix',
    search: 'Search this screen',
    count: '{shown} of {n}',
    columns: 'Columns',
    none: 'None yet.',
    noMatch: 'Nothing here matches “{q}”.',
  },
  page: {
    loading: 'Reading the stories…',
    unreadable: 'Couldn\'t read the project: {message}',
    noProjects: 'There are no story-spec projects in this folder.',
    refresh: 'Refresh',
    changed: 'The files changed. Refresh',
    changes: '{n|file} changed, not committed yet',
    noChanges: 'Nothing changed since the last commit',
    changesHeading: 'Changes not committed yet',
    changesIntro: 'Changes under the stories folder that git hasn\'t committed yet, whoever made them. Commit them like any other change.',
    commit: 'git add {dir} && git commit',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    open: 'Open',
    requirement: 'Requirement',
    scenarios: 'Scenarios',
    change: 'The change',
    noSteps: 'No steps written yet.',
    noRequirement: 'No requirement written yet.',
    pass: 'The checks pass · {warnings|warning}',
    fail: 'The checks fail · {errors|problem} · {warnings|warning}',
    reading: 'Reading the files…',
    projects: 'Projects in this folder',
    project: 'Project',
    projectOption: '{name} · {stories|story}',
    projectOpen: '{name} · {stories|story} · {open|open decision}',
    you: 'Recorded as {by}',
  },

  someone: 'Someone',
  details: 'details',
  live: 'live',
  offline: 'not following the files',

  nouns: {
    story: ['story', 'stories'], scenario: ['scenario', 'scenarios'], decision: ['decision', 'decisions'], 'open decision': ['open decision', 'open decisions'],
    persona: ['persona', 'personas'], file: ['file', 'files'], port: ['port', 'ports'], 'retired story': ['retired story', 'retired stories'],
    warning: ['warning', 'warnings'], problem: ['problem', 'problems'],
  } as Record<string, [string, string]>,

  // One sentence per rule in docs/rules.md, naming the thing ({thing}) and the fix; the rule's name goes on the details
  // line. A rule whose findings mean different things has a variant per meaning, `rule:variant`.
  findings: {
    'story-files': { module: 'model', screen: 'stories', sentence: '{thing} is missing its story.md or spec.md, or names the wrong ID. Add the file, or correct its ID.', action: 'Fix the story\'s files' },
    'requirement-tag': { module: 'model', screen: 'stories', sentence: '{thing} has no requirement tagged as its own, or tags it twice. Give it one requirement heading with its ID.', action: 'Tag one requirement' },
    'requirement-shape': { module: 'model', screen: 'stories', sentence: '{thing} needs its requirement as one sentence, WHEN … THE SYSTEM SHALL …. Make every extra condition a scenario.', action: 'Rewrite the requirement' },
    scenarios: { module: 'model', screen: 'stories', sentence: '{thing} has no scenarios yet. Write the first one.', action: 'Add a scenario', op: 'add-scenario' },
    'scenario-ownership': { module: 'model', screen: 'stories', sentence: '{thing} tags a scenario with another story\'s ID, or one ID twice. Give each scenario this story\'s ID, once.', action: 'Renumber the scenario' },
    decisions: { module: 'model', screen: 'decisions', sentence: 'The decision {thing} says neither which scenario proves it nor that any answer will do. Name its scenario, or mark it free or open.', action: 'Mark the decision' },
    'decisions:open': { module: 'model', screen: 'decisions', sentence: 'The decision {thing} waits on an answer. Answer it.', action: 'Answer', op: 'decide' },
    'decisions:missing': { module: 'model', screen: 'decisions', sentence: 'The decision {thing} is pinned by a scenario that doesn\'t exist. Name one that does.', action: 'Fix the pin' },
    'decisions:assumed': { module: 'model', screen: 'decisions', sentence: '{thing} has a test, but the decision it waits on is still open, so the test assumed an answer. Answer the decision.', action: 'Answer', op: 'decide' },
    model: { module: 'model', screen: 'records', sentence: '{thing} names a state its record doesn\'t have. Fix the spelling, or add the state to the records.', action: 'Fix the state' },
    'model:unreached': { module: 'model', screen: 'records', sentence: 'No story moves {thing}. Write the story that does, or say so in the one that already does.', action: 'Name the story' },
    'unknown-persona': { module: 'model', screen: 'people', sentence: '{thing} serves a persona the people list doesn\'t describe. Add that persona, or name one it describes.', action: 'Add a persona', op: 'add-persona' },
    'persona-without-stories': { module: 'model', screen: 'people', sentence: 'No story serves {thing}. Start one for them, or take them off the people list.', action: 'Start a story', op: 'start-story' },
    'persona-prose-mismatch': { module: 'model', screen: 'people', sentence: '{thing} names one persona in its field and another in its "As a…" line. Make them agree.', action: 'Make them agree' },
    slug: { module: 'model', screen: 'stories', sentence: 'The folder of {thing} doesn\'t match its title. Rename the folder, keeping its ID.', action: 'Rename the folder' },
    after: { module: 'model', screen: 'stories', sentence: '{thing} names a build order that can\'t hold: a story that doesn\'t exist, itself, or a circle. Name stories that exist, one way round.', action: 'Fix the build order' },
    trigger: { module: 'model', screen: 'stories', sentence: '{thing} isn\'t started by exactly one person, event, schedule or outside system. Give it one trigger.', action: 'Fix the trigger' },
    'trigger:unheard': { module: 'model', screen: 'stories', sentence: '{thing} starts on an event no story emits. Add the event to the story that causes it, or say another system sends it.', action: 'Name who emits it' },
    'derived-status': { module: 'model', screen: 'stories', sentence: '{thing} is written as done, which is now worked out from proof. Set it back to in progress.', action: 'Run story-spec migrate' },
    implementation: { module: 'implementation', screen: 'code', sentence: '{thing} has no code that says it implements it, too much, or names a file that doesn\'t exist. Name its one use case.', action: 'Name its code' },
    'story-imports': { module: 'implementation', screen: 'layers', sentence: '{thing} uses code outside its story that it may not. Depend on a port or a shared rule instead.', action: 'Go through a port' },
    'ids-outside-stories': { module: 'implementation', screen: 'layers', sentence: '{thing} talks about a story from outside the stories folder. Move the story\'s logic into the story.', action: 'Move the logic' },
    wiring: { module: 'implementation', screen: 'layers', sentence: '{thing} calls a story directly. Call it through the composition file.', action: 'Go through composition' },
    layers: { module: 'implementation', screen: 'layers', sentence: '{thing} uses code its layer may not. Turn the dependency round through a port, or move the code.', action: 'Invert the dependency' },
    'contract-tests': { module: 'implementation', screen: 'ports', sentence: 'The port {thing} has an adapter that no test exercises. Run its contract suite against each adapter.', action: 'Add a contract runner' },
    'adapter-untested': { module: 'implementation', screen: 'ports', sentence: 'The adapter {thing} isn\'t exercised by any test. Run its contract suite against it.', action: 'Run its contract suite' },
    'port-adapter': { module: 'implementation', screen: 'ports', sentence: 'The port {thing} has no adapter yet. Write one.', action: 'Write an adapter' },
    'unclaimed-code': { module: 'implementation', screen: 'code', sentence: 'No story claims {thing}. Claim it for the story it belongs to, or write that story.', action: 'Claim', op: 'claim' },
    'gen-fresh': { module: 'implementation', screen: 'code', sentence: 'The generated scenario list for {thing} is out of date. Run story-spec gen.', action: 'Run story-spec gen' },
    'framework-sync': { module: 'implementation', screen: 'code', sentence: '{thing} carries agent guidance from another version of story-spec, or none. Run story-spec sync.', action: 'Run story-spec sync' },
    'untested-scenario': { module: 'proof', screen: 'by-tests', sentence: '{thing} has no test yet. Write its test.', action: 'Write its test' },
    'orphan-test': { module: 'proof', screen: 'by-tests', sentence: 'A test of {thing} names a scenario its spec doesn\'t have. Remove the test, or add the scenario.', action: 'Match the test to the spec' },
    'failing-test': { module: 'proof', screen: 'by-tests', sentence: '{thing} has a failing test. Fix the code or the test.', action: 'Fix the code or the test' },
    'must-pass': { module: 'proof', screen: 'by-tests', sentence: '{thing} is written as done, but its test doesn\'t pass. Run story-spec migrate, then fix the test.', action: 'Run story-spec migrate' },
    proof: { module: 'proof', screen: 'by-a-run', sentence: '{thing} failed a check. Fix it, then check it again.', action: 'Check again', op: 'check-again' },
    'proof:person': { module: 'proof', screen: 'by-a-person', sentence: '{thing} failed a check by hand. Fix it, then check it again.', action: 'Check again', op: 'check-again' },
    'proof:stale': { module: 'proof', screen: 'stale', sentence: '{thing} changed since it was checked, so the check no longer counts. Check it again.', action: 'Check again', op: 'check-again' },
    unproven: { module: 'proof', screen: 'by-tests', sentence: '{thing} isn\'t done, and the release waits on it. Prove what is still open.', action: 'Prove what is open' },
    tests: { module: 'proof', screen: 'by-tests', sentence: 'The test command for {thing} didn\'t write its report. Check the test command in the settings.', action: 'Check the test command' },
  } satisfies Record<string, FindingWords>,
  /** What a finding names when it names nothing more particular. */
  project: 'this project',
}

export type Vocabulary = typeof VOCABULARY
