# Story Structure

The shape of each story and of the calendar as a whole.

## The calendar

- **24 stories, Dec 1–24**.
- Each story is **self-contained**: a reader new to the calendar can enjoy it. Continuity rewards daily readers but is never required to understand a story.
- **A seasonal arc** builds across the month toward the last week of term and Christmas Eve.
- **Real calendar:** e.g. Dec 1, 2026 is a **Tuesday**; weekends are Dec 5–6, 12–13 and 19–20. The winter solstice is **Monday Dec 21, 2026**. Decide the dates of all big events (Hogsmeade weekends, any ball or feast, the end of term, the solstice pact) _before_ writing, and keep weekdays correct.
- **Balance:**
  - **Point of view:** roughly even across the main characters.
  - **Tone:** a mix of light adventures, mysteries, classes, creatures, festive set pieces and quieter character stories; not more than two "serious" stories in a row.
  - **Ensemble:** every main character gets at least one story centered on their own arc.
- **Continuity:** Aim for continuity between the stories. Before writing a story, check what each character already knows and has done.

## A single story

- **Length:** 2000-4000 words, aim for ~3000 (this has increased from 2025). Respect this limit; cut repetition before cutting plot.
- **One central premise:** a single concrete magical idea, problem or event (a strange object, a lesson gone wrong, a creature, a mystery, a tradition). Introduce it in the first few paragraphs.
- **Cast:** at least two of the main characters; one point-of-view character per scene.
- **Callbacks:** at most one or two light references to earlier stories, where they add something.

## File format

- **Path:** `src/data/stories/<year>/YYYY-12-DD.md`
- **Image:** `src/images/<year>/YYYY-12-DD.png`
- **Frontmatter:** all values are quoted strings.

```yaml
---
title: "Story Title"
date: "YYYY-12-01"
image: "../../../images/<year>/YYYY-12-01.png"
---
```

- **Body:** plain Markdown prose. Use `---` for scene breaks; the site renders them as a decorative divider. No headings inside the story.
