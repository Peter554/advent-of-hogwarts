# Image generation

Generates the story images with the Gemini API. To keep the illustrations consistent, every request includes **reference images**: by default the 2025 image of all four friends (`src/images/2025/2025-12-12.png`). The model matches last year's art style and character designs instead of reinventing them each time.

## Setup (once)

1. Install dependencies with `just install`.
2. Create an API key at <https://aistudio.google.com/apikey> (image models need billing enabled on the project) and put it in a `.env` file at the repo root. Bun loads it automatically, and `.env` is git-ignored.
   ```
   GEMINI_API_KEY=...
   ```
3. List the models your key can use:
   ```
   just images models
   ```
   Pick the Gemini image model (it will have `image` in its name, e.g. `gemini-2.5-flash-image` or a newer one; use the name without the `models/` prefix) and set it as `model` in `config.json`.
4. Check that a prompt is put together correctly without calling the API:
   ```
   just images generate image-gen/prompts/example.md --dry-run
   ```
5. Try a real generation:
   ```
   just images generate image-gen/prompts/example.md
   ```
   The result is saved to `image-gen/out/example-v1.jpg` (or `.png`, depending on what the model returns).

## Making a story image

1. Write `image-gen/prompts/YYYY/YYYY-12-DD.md`, e.g. `prompts/2026/2026-12-01.md`. It contains the scene: who is in it, where, what is happening, and the light and mood. Character descriptions and style are added automatically from `characters.md` and `style.md`. Because the file is named after a date, the script also tells the model which year the story is set in, and the friends' age and school year then (worked out from 2025, when they were 14-year-old fourth years). To add references for just this image, list them in the frontmatter (see `prompts/example.md`), e.g. an earlier image of the same place, or an approved portrait of a character.
2. Generate a few options:
   ```
   just images generate image-gen/prompts/YYYY/YYYY-12-DD.md --variants 3
   ```
   This writes `image-gen/out/YYYY-12-DD-v1.jpg` … `-v3.jpg` (the extension follows what the model returns, often JPEG). That folder is git-ignored.
3. Copy the one you like into the site:
   ```
   just images pick YYYY-12-DD 2
   ```
   This copies it to `src/images/YYYY/YYYY-12-DD.jpg` (keeping its extension) and prints the `image:` line to put in the story's frontmatter.

Other options:

- `--model NAME` overrides the model for one run.
- `--no-default-references` leaves out the references in `config.json`.
- `--dry-run` prints the prompt and references without sending anything.

## Files

| File            | Purpose                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate.ts`   | The project-specific script: `models`, `generate`, `pick`, prompt assembly and story-year logic.                                                                |
| `lib.ts`        | Generic Gemini image helpers (request, response parsing, model listing, arg and frontmatter parsing). No knowledge of this repo, so it can be reused elsewhere. |
| `config.json`   | Model, default reference images, and `generationConfig` (extra generation fields).                                                                              |
| `style.md`      | Art-style instructions added to every prompt.                                                                                                                   |
| `characters.md` | Descriptions of the four friends added to every prompt. Add new recurring characters here.                                                                      |
| `prompts/`      | `example.md`, plus one folder per year with a scene prompt per story.                                                                                           |
| `out/`          | Generated variants (git-ignored).                                                                                                                               |

## Notes for Claude Code (running locally)

- Generate, then **look at the variants** with the Read tool before picking one. Check each against the reference image(s) and `characters.md`:
  - Mira's glasses and braid.
  - Finn's red hair and freckles.
  - Zara's box braids.
  - Elliot's undercut and rings.
  - House colors.
  - Who is in the scene.
  - No stray text or watermarks.
- If a variant drifts, regenerate, or make the scene prompt more specific. Don't present weak options.
- To keep a new recurring character (e.g. Amara) consistent:
  1. Generate a clear portrait of them.
  2. Have the user approve it.
  3. Save it under `image-gen/references/`.
  4. List it in the `references` of every prompt that includes them.
- Requests go through the `@google/genai` SDK (a dev dependency) to `generateContent` with `responseModalities: ["IMAGE", "TEXT"]` and the references as inline image parts. To change generation options, add them to `generationConfig` in `config.json`; it is passed as the SDK's `config`. For example, to request an aspect ratio: `"imageConfig": { "aspectRatio": "16:9" }`.
- If the response has no image, the script prints the model's text reply. The usual causes are a wrong model name, a model without image output, or a safety block.
