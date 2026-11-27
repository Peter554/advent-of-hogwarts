# Image generation

Generates the story images with Gemini through the LiteLLM gateway at `https://litellm.kraken.tech`. To keep the illustrations consistent, every request includes **reference images**: by default the 2025 image of all four friends (`src/images/2025/2025-12-12.png`). The model matches last year's art style and character designs instead of reinventing them each time.

## Setup (once)

1. Install dependencies with `just install`.
2. Put your LiteLLM token in a `.env` file at the repo root. Bun loads it automatically, and `.env` is git-ignored.
   ```
   LITELLM_API_KEY=sk-...
   ```
3. List the gateway's models:
   ```
   just images models
   ```
   Pick the Gemini image model (it will have `image` in its name, e.g. `gemini-2.5-flash-image` or a newer one) and set it as `model` in `config.json`.
4. Check that a prompt is put together correctly without calling the API:
   ```
   just images generate image-gen/prompts/2026/example.md --dry-run
   ```
5. Try a real generation:
   ```
   just images generate image-gen/prompts/2026/example.md
   ```
   The result is saved to `image-gen/out/example-v1.png`.

## Making a story image

1. Write `image-gen/prompts/2026/2026-12-DD.md`. It contains the scene: who is in it, where, what is happening, and the light and mood. Character descriptions and style are added automatically from `characters.md` and `style.md`. To add references for just this image, list them in the frontmatter (see `prompts/2026/example.md`), e.g. a 2025 image of the same place, or an approved 2026 image of a character.
2. Generate a few options:
   ```
   just images generate image-gen/prompts/2026/2026-12-DD.md --variants 3
   ```
   This writes `image-gen/out/2026-12-DD-v1.png` … `-v3.png`. That folder is git-ignored.
3. Copy the one you like into the site:
   ```
   just images pick 2026-12-DD 2
   ```
   This copies it to `src/images/2026/2026-12-DD.png`.

Other options:
- `--model NAME` overrides the model for one run.
- `--no-default-references` leaves out the references in `config.json`.
- `--dry-run` prints the prompt and references without sending anything.

## Files

| File | Purpose |
| --- | --- |
| `generate.ts` | The script: `models`, `generate`, `pick`. |
| `config.json` | Gateway URL, model, default reference images, and `extraBody` (extra request fields). |
| `style.md` | Art-style instructions added to every prompt. |
| `characters.md` | Descriptions of the four friends added to every prompt. Add new recurring characters here. |
| `prompts/2026/` | One scene prompt per story. |
| `out/` | Generated variants (git-ignored). |

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
- The request goes to `/v1/chat/completions` with `modalities: ["image", "text"]` and the references as `image_url` data URIs. If the gateway needs a provider-specific option, add it to `extraBody` in `config.json` rather than changing the code. For example, to request an aspect ratio, try `"image_config": {"aspect_ratio": "16:9"}` and check the gateway's docs.
- If the gateway returns no image, the script prints the model's text reply. The usual causes are a wrong model name, or a model without image output.
