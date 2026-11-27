/**
 * Generate story images with the Gemini API (Google AI Studio key).
 *
 * Usage (from the repo root):
 *   bun image-gen/generate.ts models
 *   bun image-gen/generate.ts generate <prompt-file> [--variants N] [--model NAME] [--dry-run]
 *   bun image-gen/generate.ts pick <name> <variant>
 *
 * Needs GEMINI_API_KEY in the environment. See image-gen/README.md.
 */
import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  buildRequest,
  extensionFor,
  fail,
  generateImage,
  isLikelyImageModel,
  listModels,
  readPromptFile,
} from "./lib";

const ROOT = join(import.meta.dir, "..");
const HERE = import.meta.dir;
const OUT_DIR = join(HERE, "out");

type Config = {
  model: string;
  /** Reference images (paths relative to the repo root) sent with every prompt. */
  references: string[];
  /** Extra fields merged into the SDK's `config`, e.g. `{ "imageConfig": { "aspectRatio": "16:9" } }`. */
  generationConfig?: Record<string, unknown>;
};

const config: Config = JSON.parse(
  readFileSync(join(HERE, "config.json"), "utf8"),
);

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) fail("GEMINI_API_KEY is not set. See image-gen/README.md.");
  return key;
}

/** The four friends were 14-year-old fourth years in December 2025. */
const BASE_YEAR = 2025;
const BASE_AGE = 14;
const SCHOOL_YEARS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
];

/** For prompt files named YYYY-MM-DD, describe the friends' age in that year. */
function settingNote(name: string): string {
  const match = name.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) return "";
  const year = Number(match[1]);
  const age = BASE_AGE + (year - BASE_YEAR);
  const schoolYear = SCHOOL_YEARS[3 + (year - BASE_YEAR)];
  return (
    `The story is set in December ${year}. The four friends are ${age} years old` +
    (schoolYear ? `, ${schoolYear} years at Hogwarts.` : ".")
  );
}

function buildPrompt(
  scene: string,
  referenceCount: number,
  setting: string,
): string {
  const style = readFileSync(join(HERE, "style.md"), "utf8").trim();
  const characters = readFileSync(join(HERE, "characters.md"), "utf8").trim();
  const referenceNote =
    referenceCount > 0
      ? `You are given ${referenceCount} reference image(s). Match their art style exactly, ` +
        `and draw any recurring characters so they are clearly the same people as in the references ` +
        `(same faces, hair, skin tone and build), at the age given below if there is one. Do not copy the references' composition.`
      : "";
  return [
    "Create one illustration for a story in an online advent calendar.",
    referenceNote,
    "## Style\n" + style,
    "## Recurring characters\n" +
      [setting, characters].filter(Boolean).join("\n\n"),
    "## Scene\n" + scene,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function models(): Promise<void> {
  const ids = await listModels(apiKey()).catch((error: Error) =>
    fail(error.message),
  );
  const likely = ids.filter(isLikelyImageModel);
  console.log(`${ids.length} models available.`);
  if (likely.length)
    console.log(`Likely image models:\n  ${likely.join("\n  ")}`);
  console.log(`All models:\n  ${ids.join("\n  ")}`);
}

type GenerateFlags = {
  variants?: string;
  model?: string;
  "dry-run"?: boolean;
  "no-default-references"?: boolean;
};

async function generate(
  promptFile: string,
  flags: GenerateFlags,
): Promise<void> {
  if (!existsSync(promptFile)) fail(`Prompt file not found: ${promptFile}`);
  const name = basename(promptFile, extname(promptFile));
  const variants = Number(flags.variants ?? 1);
  if (!Number.isInteger(variants) || variants < 1)
    fail("--variants must be a positive integer");
  const model = flags.model ?? config.model;

  const { references: own, scene } = readPromptFile(promptFile);
  const references = flags["no-default-references"]
    ? own
    : [...config.references, ...own];
  const prompt = buildPrompt(scene, references.length, settingNote(name));

  const body = buildRequest(
    prompt,
    references.map((path) => join(ROOT, path)),
    config.generationConfig,
  );

  if (flags["dry-run"]) {
    console.log(
      `Model: ${model}\nReferences:\n  ${references.join("\n  ") || "(none)"}`,
    );
    console.log(`\n--- Prompt ---\n${prompt}`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (let v = 1; v <= variants; v++) {
    process.stdout.write(`Generating ${name} variant ${v}/${variants}… `);
    const { mime, data } = await generateImage(apiKey(), model, body).catch(
      (error) => {
        console.log("failed.");
        fail(error.message);
      },
    );
    const file = join(OUT_DIR, `${name}-v${v}${extensionFor(mime)}`);
    await Bun.write(file, Buffer.from(data, "base64"));
    console.log(`saved ${file.slice(ROOT.length + 1)}`);
  }
}

function pick(name: string, variant: string): void {
  const year = name.match(/^(\d{4})-\d{2}-\d{2}$/)?.[1];
  if (!year) fail("pick only works for story images named YYYY-MM-DD.");
  const candidates = [".png", ".jpg", ".webp"].map((ext) =>
    join(OUT_DIR, `${name}-v${variant}${ext}`),
  );
  const source =
    candidates.find(existsSync) ??
    fail(`No variant ${variant} for ${name} in image-gen/out/.`);
  const target = join(ROOT, "src", "images", year, `${name}${extname(source)}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(
    `Copied ${source.slice(ROOT.length + 1)} -> ${target.slice(ROOT.length + 1)}`,
  );
  console.log(
    `Story frontmatter: image: "../../../images/${year}/${basename(target)}"`,
  );
}

function parseCli(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      variants: { type: "string" },
      model: { type: "string" },
      "dry-run": { type: "boolean" },
      "no-default-references": { type: "boolean" },
    },
  });
}

const [command, ...rest] = process.argv.slice(2);
let parsed: ReturnType<typeof parseCli>;
try {
  parsed = parseCli(rest);
} catch (error) {
  fail((error as Error).message);
}
const { positionals: positional, values: flags } = parsed;

switch (command) {
  case "models":
    await models();
    break;
  case "generate":
    if (!positional[0])
      fail(
        "Usage: generate <prompt-file> [--variants N] [--model NAME] [--dry-run]",
      );
    await generate(positional[0], flags);
    break;
  case "pick": {
    const [name, variant] = positional;
    if (!name || !variant) fail("Usage: pick <YYYY-MM-DD> <variant>");
    pick(name, variant);
    break;
  }
  default:
    console.log(
      readFileSync(import.meta.path, "utf8")
        .match(/\/\*\*([\s\S]*?)\*\//)?.[1]
        ?.replace(/^ \* ?/gm, ""),
    );
}
