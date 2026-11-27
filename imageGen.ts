/**
 * Generate images with the Gemini API.
 *
 *   import { getModels, generateImage } from "./imageGen";
 *
 * Needs GEMINI_API_KEY in the environment unless `apiKey` is passed.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  GoogleGenAI,
  type TextContent,
  type ImageContent,
} from "@google/genai";

export const DEFAULT_MODEL = "gemini-3.1-flash-image";

const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type GeneratedImage = {
  data: Buffer;
  /** Read from the response; it varies by model. */
  mimeType: (typeof MIME_TYPES)[number];
};

export type ReferenceImage = {
  /** Path to an image file. */
  path: string;
  /** What the image is and how to use it, e.g. "Mira, round glasses and a braid". */
  description?: string;
};

export type ClientOptions = {
  /** Defaults to the GEMINI_API_KEY environment variable. */
  apiKey?: string;
};

export type GenerateImageOptions = ClientOptions & {
  /** Defaults to DEFAULT_MODEL. */
  model?: string;
  /** e.g. "1:1", "16:9", "9:16". The model picks one if omitted. */
  aspectRatio?: string;
  /** "512", "1K", "2K" or "4K". The model default applies if omitted. */
  imageSize?: string;
};

/** IDs of the models the API key can use, sorted, without the `models/` prefix. */
export async function getModels(
  options: ClientOptions = {},
): Promise<string[]> {
  const ids: string[] = [];
  for await (const model of await client(options).models.list({
    config: { pageSize: 1000 },
  })) {
    if (model.name) ids.push(model.name.replace(/^models\//, ""));
  }
  return ids.sort();
}

/**
 * Generate one image; the format is whatever the model returns (see GeneratedImage.mimeType) from a prompt, optionally guided by reference images.
 *
 * Each reference is sent as a text label ("Reference 1 — <description>:")
 * followed by the image, then the prompt, so the prompt can refer to
 * "Reference 1", "Reference 2" and so on.
 *
 * Uses the Interactions API, which (unlike `generateContent`) lets us request
 * the output format. Throws if the model returns no image; the message
 * includes any text it replied with.
 */
export async function generateImage(
  prompt: string,
  referenceImages: ReferenceImage[] = [],
  {
    model = DEFAULT_MODEL,
    aspectRatio,
    imageSize,
    ...clientOptions
  }: GenerateImageOptions = {},
): Promise<GeneratedImage> {
  const interaction = await client(clientOptions).interactions.create({
    model,
    input: [
      ...referenceContent(referenceImages),
      { type: "text", text: prompt },
    ],
    response_format: {
      type: "image",
      aspect_ratio: aspectRatio,
      image_size: imageSize,
    },
  });

  const image = interaction.output_image;
  if (image?.data) {
    const mimeType = MIME_TYPES.find((type) => type === image.mime_type);
    if (!mimeType) {
      throw new Error(`${model} returned unsupported type ${image.mime_type}.`);
    }
    return { data: Buffer.from(image.data, "base64"), mimeType };
  }

  const reply = interaction.output_text;
  throw new Error(
    `No image returned by ${model}.${reply ? ` It said: ${reply}` : ""}`,
  );
}

function client({
  apiKey = process.env.GEMINI_API_KEY,
}: ClientOptions): GoogleGenAI {
  if (!apiKey)
    throw new Error("No API key: set GEMINI_API_KEY or pass apiKey.");
  return new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
}

type Content = TextContent | ImageContent;

function referenceContent(references: ReferenceImage[]): Content[] {
  return references.flatMap(({ path, description }, index): Content[] => {
    const label = `Reference ${index + 1}${description ? ` — ${description}` : ""}:`;
    return [{ type: "text", text: label }, imageContent(path)];
  });
}

function imageContent(path: string): Content {
  if (!existsSync(path)) throw new Error(`Reference image not found: ${path}`);
  const mimeType = Bun.file(path).type;
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Reference is not a recognised image file: ${path}`);
  }
  return {
    type: "image",
    mime_type: mimeType,
    data: readFileSync(path).toString("base64"),
  };
}
