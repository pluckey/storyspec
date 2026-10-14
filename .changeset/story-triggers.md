---
"storyspec": minor
"create-storyspec": minor
---

Stories say what starts them, which decisions are still open, and which records they move through which states.

- `trigger:` in story.md: what starts the story, as `actor:<role>`, `event:<event>`, `schedule:<name>` or `external:<system>`. `emits:` lists the events a story causes. TRACE.md shows the trigger beside each story and adds a Triggers table: each trigger, the stories that emit it (for an event) and the stories it starts.
- New rule `trigger`: an unknown kind, a missing name or a second trigger is an error; an event no story emits is a warning.
- Open decisions: a decision marked `(open)` blocks the scenarios it names. They need no test yet and show as blocked in TRACE.md; a test of one is a warning, since it had to assume an answer.
- `stories/MODEL.md`: records and the transitions between their states. New rule `model`: an event for a state a record doesn't have is an error, and a state no story moves a record into is a warning. TRACE.md gets a Model section with each record's lifecycle.
