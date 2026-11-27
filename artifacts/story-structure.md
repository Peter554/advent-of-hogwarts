# Story Structure

The shape of each story and of the calendar as a whole.

## The calendar

- **24 stories, Dec 1–24**, one published each day at midnight CET.
- Each story is **self-contained**: a reader new to the calendar can enjoy it. Continuity rewards daily readers but is never required to understand a story.
- **A seasonal arc** builds across the month toward the last week of term and Christmas Eve.
- **Real calendar:**
  - Dec 1, 2026 is a **Tuesday**; weekends are Dec 5–6, 12–13 and 19–20.
  - The winter solstice is **Monday Dec 21, 2026**.
  - Decide the dates of all big events (Hogsmeade weekends, any ball or feast, the end of term, the solstice pact) *before* writing, and keep weekdays correct.
- **Balance:**
  - **Point of view:** roughly even across the main characters.
  - **Tone:** a mix of light adventures, mysteries, classes, creatures, festive set pieces and quieter character stories; not more than two "serious" stories in a row.
  - **Ensemble:** every main character gets at least one story centered on their own arc.
- **Continuity:** keep the continuity sheet (see `2025-learnings.md`) and update it after each story. Before writing a story, check what each character already knows and has done.

## A single story

- **Length:** 1,200–2,400 words (about 5–10 minutes' reading). Aim for about 1,800. This is a hard limit; cut repetition before cutting plot.
- **One central premise:** a single concrete magical idea, problem or event (a strange object, a lesson gone wrong, a creature, a mystery, a tradition). Introduce it in the first few paragraphs.
- **Cast:** at least two of the main characters; one point-of-view character per scene.
- **Shape:**
  1. **Opening:** start in a scene, close to the premise, with a sensory hook. No warm-up recap of earlier stories.
  2. **Middle:** complicate the premise. Something goes wrong, someone disagrees, or the obvious approach fails. Let the characters' different strengths and flaws matter.
  3. **Turn:** a choice or realization by the point-of-view character, preferably shown through action.
  4. **Ending:**
     - Resolve the premise. The emotional thread may stay a little open.
     - End on a concrete image, line or beat, **not** a summary of the lesson.
     - The final scene should be short.
- **Callbacks:** at most one or two light references to earlier stories, only where they add something.

## File format

- **Path:** `src/data/stories/2026/2026-12-DD.md`
- **Image:** `src/images/2026/2026-12-DD.png`
- **Frontmatter:** all values are quoted strings.

```yaml
---
title: "Story Title"
date: "2026-12-01"
image: "../../../images/2026/2026-12-01.png"
---
```

- **Body:** plain Markdown prose. Use `---` for scene breaks; the site renders them as a decorative divider. No headings inside the story.
