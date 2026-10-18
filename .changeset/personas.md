---
"storyspec": minor
"create-storyspec": patch
---

Personas: describe the people a product serves in `stories/PERSONAS.md` (one `## Name` heading each, with a line of prose), and tie each story to them with `persona:` in story.md, or let its "As a…" line decide. The trace warns on a persona that isn't described (`unknown-persona`), one no story serves (`persona-without-stories`) and a story whose field and prose disagree (`persona-prose-mismatch`); TRACE.md ends with a grid of epics by personas, and `storyspec trace --by persona` gives one stories table per persona. An open decision can name who answers it with `(open: <persona>)`. `storyspec ui` gets a Personas tab that shows one persona's journey (their prose, the decisions waiting on them, their stories and proof), lists personas with no story yet and starts one for them, and adds a persona to PERSONAS.md as a diff. New projects start with a `Member` persona.
