/**
 * Project-independent helpers for generating images with the Gemini API.
 * Nothing here knows about this repo's layout, prompts or characters.
 * Functions throw `Error` on failure; `fail` is a small CLI helper for callers.
 */
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import {
  GoogleGenAI,
  type GenerateContentConfig,
  type Part,
} from "@google/genai";

export type GeneratedImage = { mime: string; data: string };

export type GenerateRequest = {
  contents: { role: "user"; parts: Part[] }[];
  config: GenerateContentConfig;
};

export function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

/** Minimal frontmatter parser: supports `references:` as a YAML list of paths. */
export function readPromptFile(path: string): {
  references: string[];
  scene: string;
} {
  const text = readFileSync(path, "utf8");
  const [, frontmatter, body] =
    text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) ?? [];
  if (frontmatter === undefined || body === undefined)
    return { references: [], scene: text.trim() };
  const references: string[] = [];
  let inReferences = false;
  for (const line of frontmatter.split("\n")) {
    if (/^references:\s*$/.test(line)) {
      inReferences = true;
    } else if (inReferences && /^\s*-\s+/.test(line)) {
      references.push(
        line
          .replace(/^\s*-\s+/, "")
          .replace(/^["']|["']$/g, "")
          .trim(),
      );
    } else if (line.trim() !== "") {
      inReferences = false;
    }
  }
  return { references, scene: body.trim() };
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

/** File extension (with dot) for an image MIME type. */
export function extensionFor(mime: string): string {
  return EXT[mime] ?? ".png";
}

function inlineImage(path: string): Part {
  if (!existsSync(path)) throw new Error(`Reference image not found: ${path}`);
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`Unsupported image type: ${path}`);
  return {
    inlineData: { mimeType: mime, data: readFileSync(path).toString("base64") },
  };
}

/** Model ids the key can use, sorted, without the `models/` prefix. */
export async function listModels(apiKey: string): Promise<string[]> {
  const ids: string[] = [];
  for await (const model of await new GoogleGenAI({ apiKey }).models.list({
    config: { pageSize: 1000 },
  })) {
    if (model.name) ids.push(model.name.replace(/^models\//, ""));
  }
  return ids.sort();
}

export function isLikelyImageModel(id: string): boolean {
  return /image|imagen|banana/i.test(id);
}

/** Build the request. Reference images are file paths, sent inline after the prompt. */
export function buildRequest(
  prompt: string,
  referencePaths: string[],
  config: GenerateContentConfig = {},
): GenerateRequest {
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, ...referencePaths.map(inlineImage)],
      },
    ],
    config: { responseModalities: ["IMAGE", "TEXT"], ...config },
  };
}

/** Generate one image. Throws if the model returns none (the message includes any text it replied with). */
export async function generateImage(
  apiKey: string,
  model: string,
  request: GenerateRequest,
): Promise<GeneratedImage> {
  const response = await new GoogleGenAI({ apiKey }).models.generateContent({
    model,
    ...request,
  });
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data)
      return {
        mime: part.inlineData.mimeType ?? "image/png",
        data: part.inlineData.data,
      };
  }
  const text = response.text || response.promptFeedback?.blockReason || "";
  throw new Error(
    "The response contained no image. Check the model name supports image output." +
      (text ? `\nModel said: ${text}` : ""),
  );
}
