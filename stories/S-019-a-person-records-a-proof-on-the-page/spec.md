# S-019 spec

`storyspec prove` becomes a screen. Proof › By a person lists every scenario that needs a person, pending and
done, and records the check as the CLI would, as a diff to `stories/PROOF.json`.

### Requirement: Recording a proof {#S-019}

WHEN a person marks a manual scenario as holding or failing on the page, with an optional note THE SYSTEM SHALL record the proof in `stories/PROOF.json` exactly as `storyspec prove` would and show it as a diff.

#### Scenario: Proving writes the file {#S-019.1}

- GIVEN a manual scenario with no proof
- WHEN the person marks it as holding with the note "checked in Chrome"
- THEN PROOF.json gains an entry with the scenario, the manual tier, the person, the time, the note and the scenario's text hash, and the diff shows it

#### Scenario: Failing is recorded too {#S-019.2}

- GIVEN a manual scenario
- WHEN the person marks it as failing
- THEN the entry records a failed proof and the scenario reads as "failed a check" with the note

#### Scenario: A stale proof shows then and now {#S-019.3}

- GIVEN a scenario proven by a person whose text changed since
- WHEN it is opened on By a person
- THEN the old text and the new text are shown side by side and the person can check again

#### Scenario: The CLI and the page agree {#S-019.4}

- GIVEN a proof recorded from the page
- WHEN `storyspec trace` runs
- THEN it reads the proof as it would one recorded by `storyspec prove`

#### Scenario: Who is named {#S-019.5}

- GIVEN git knows the person's name
- WHEN a proof is recorded from the page
- THEN it carries that name, as the CLI's `--by` default does

#### Scenario: Pending and done are both listed {#S-019.6}

- GIVEN a project with three manual scenarios, one proven
- WHEN By a person is read
- THEN two are listed as pending with the scenario text and a Check action, and one as done with who and when

### Decisions

- The page calls the same function the CLI's `prove` uses, so there is one writer of PROOF.json (pinned by S-019.4)
- The note is optional; the time is the server's clock (free)
