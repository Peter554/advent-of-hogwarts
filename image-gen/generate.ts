/**
 * Generate story images with Gemini through a LiteLLM gateway.
 *
 * Usage (from the repo root):
 *   bun image-gen/generate.ts models
 *   bun image-gen/generate.ts generate <prompt-file> [--variants N] [--model NAME] [--dry-run]
 *   bun image-gen/generate.ts pick <name> <variant>
 *
 * Needs LITELLM_API_KEY in the environment. See image-gen/README.md.
 */
import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const HERE = import.meta.dir;
const OUT_DIR = join(HERE, "out");

type Config = {
  baseUrl: string;
  model: string;
  /** Reference images (paths relative to the repo root) sent with every prompt. */
  references: string[];
  /** Extra fields merged into the request body, e.g. provider-specific image options. */
  extraBody?: Record<string, unknown>;
};

const config: Config = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));
const baseUrl = (process.env.LITELLM_BASE_URL ?? config.baseUrl).replace(/\/+$/, "");

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function apiKey(): string {
  const key = process.env.LITELLM_API_KEY;
  if (!key) fail("LITELLM_API_KEY is not set. See image-gen/README.md.");
  return key;
}

function parseArgs(args: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

/** Minimal frontmatter parser: supports `references:` as a YAML list of paths. */
function readPromptFile(path: string): { references: string[]; scene: string } {
  const text = readFileSync(path, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { references: [], scene: text.trim() };
  const references: string[] = [];
  let inReferences = false;
  for (const line of match[1].split("\n")) {
    if (/^references:\s*$/.test(line)) {
      inReferences = true;
    } else if (inReferences && /^\s*-\s+/.test(line)) {
      references.push(line.replace(/^\s*-\s+/, "").replace(/^["']|["']$/g, "").trim());
    } else if (line.trim() !== "") {
      inReferences = false;
    }
  }
  return { references, scene: match[2].trim() };
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function dataUri(path: string): string {
  const full = join(ROOT, path);
  if (!existsSync(full)) fail(`Reference image not found: ${path}`);
  const mime = MIME[extname(path).toLowerCase()] ?? fail(`Unsupported image type: ${path}`);
  return `data:${mime};base64,${readFileSync(full).toString("base64")}`;
}

function buildPrompt(scene: string, referenceCount: number): string {
  const style = readFileSync(join(HERE, "style.md"), "utf8").trim();
  const characters = readFileSync(join(HERE, "characters.md"), "utf8").trim();
  const referenceNote =
    referenceCount > 0
      ? `You are given ${referenceCount} reference image(s). Match their art style exactly, ` +
        `and draw any recurring characters so they are clearly the same people as in the references ` +
        `(same faces, hair, skin tone and build), one year older. Do not copy the references' composition.`
      : "";
  return [
    "Create one illustration for a story in an online advent calendar.",
    referenceNote,
    "## Style\n" + style,
    "## Recurring characters\n" + characters,
    "## Scene\n" + scene,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function post(path: string, body: unknown): Promise<any> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) fail(`${response.status} ${response.statusText} from ${path}:\n${text.slice(0, 2000)}`);
  return JSON.parse(text);
}

/** Pull base64 images out of the response, whichever shape the gateway uses. */
function extractImages(json: any): { mime: string; data: string }[] {
  const found: { mime: string; data: string }[] = [];
  const addUrl = (url: unknown) => {
    if (typeof url !== "string") return;
    const m = url.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
    if (m) found.push({ mime: m[1], data: m[2] });
  };
  for (const choice of json?.choices ?? []) {
    const message = choice?.message ?? {};
    // LiteLLM's format for Gemini image output.
    for (const image of message.images ?? []) addUrl(image?.image_url?.url ?? image?.url);
    // Content given as a list of parts.
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        addUrl(part?.image_url?.url ?? part?.image_url);
        const inline = part?.inline_data ?? part?.inlineData;
        if (inline?.data) found.push({ mime: inline.mime_type ?? inline.mimeType ?? "image/png", data: inline.data });
      }
    }
    // A data URI embedded in plain text content.
    if (typeof message.content === "string") {
      for (const m of message.content.matchAll(/data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)/g)) {
        found.push({ mime: m[1], data: m[2] });
      }
    }
  }
  // OpenAI images API shape.
  for (const item of json?.data ?? []) if (item?.b64_json) found.push({ mime: "image/png", data: item.b64_json });
  return found;
}

const EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

async function listModels() {
  const response = await fetch(`${baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${apiKey()}` } });
  const text = await response.text();
  if (!response.ok) fail(`${response.status} ${response.statusText}:\n${text.slice(0, 2000)}`);
  const ids: string[] = (JSON.parse(text).data ?? []).map((m: any) => m.id).sort();
  const likely = ids.filter((id) => /image|imagen|banana/i.test(id));
  console.log(`${ids.length} models available.`);
  if (likely.length) console.log(`Likely image models:\n  ${likely.join("\n  ")}`);
  console.log(`All models:\n  ${ids.join("\n  ")}`);
}

async function generate(promptFile: string, flags: Record<string, string | true>) {
  if (!existsSync(promptFile)) fail(`Prompt file not found: ${promptFile}`);
  const name = basename(promptFile, extname(promptFile));
  const variants = Number(flags.variants ?? 1);
  if (!Number.isInteger(variants) || variants < 1) fail("--variants must be a positive integer");
  const model = typeof flags.model === "string" ? flags.model : config.model;

  const { references: own, scene } = readPromptFile(promptFile);
  const references = flags["no-default-references"] ? own : [...config.references, ...own];
  const prompt = buildPrompt(scene, references.length);

  const body = {
    model,
    modalities: ["image", "text"],
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...references.map((path) => ({ type: "image_url", image_url: { url: dataUri(path) } })),
        ],
      },
    ],
    ...config.extraBody,
  };

  if (flags["dry-run"]) {
    console.log(`Model: ${model}\nGateway: ${baseUrl}\nReferences:\n  ${references.join("\n  ") || "(none)"}`);
    console.log(`\n--- Prompt ---\n${prompt}`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (let v = 1; v <= variants; v++) {
    process.stdout.write(`Generating ${name} variant ${v}/${variants}… `);
    const json = await post("/v1/chat/completions", body);
    const images = extractImages(json);
    if (images.length === 0) {
      console.log("no image returned.");
      const text = json?.choices?.[0]?.message?.content;
      if (text) console.log(`Model said: ${typeof text === "string" ? text : JSON.stringify(text)}`);
      fail("The response contained no image. Check the model name and the gateway's image support.");
    }
    const { mime, data } = images[0];
    const file = join(OUT_DIR, `${name}-v${v}${EXT[mime] ?? ".png"}`);
    await Bun.write(file, Buffer.from(data, "base64"));
    console.log(`saved ${file.slice(ROOT.length + 1)}`);
  }
}

function pick(name: string, variant: string) {
  const match = name.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) fail("pick only works for story images named YYYY-MM-DD.");
  const candidates = [".png", ".jpg", ".webp"].map((ext) => join(OUT_DIR, `${name}-v${variant}${ext}`));
  const source = candidates.find(existsSync) ?? fail(`No variant ${variant} for ${name} in image-gen/out/.`);
  if (!source.endsWith(".png")) fail(`${source} is not a PNG; convert it first (stories expect .png).`);
  const target = join(ROOT, "src", "images", match[1], `${name}.png`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`Copied ${source.slice(ROOT.length + 1)} -> ${target.slice(ROOT.length + 1)}`);
}

const [command, ...rest] = process.argv.slice(2);
const { positional, flags } = parseArgs(rest);

switch (command) {
  case "models":
    await listModels();
    break;
  case "generate":
    if (!positional[0]) fail("Usage: generate <prompt-file> [--variants N] [--model NAME] [--dry-run]");
    await generate(positional[0], flags);
    break;
  case "pick":
    if (positional.length < 2) fail("Usage: pick <YYYY-MM-DD> <variant>");
    pick(positional[0], positional[1]);
    break;
  default:
    console.log(readFileSync(import.meta.path, "utf8").match(/\/\*\*([\s\S]*?)\*\//)![1].replace(/^ \* ?/gm, ""));
}
