import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

const stories = defineCollection({
  loader: glob({ pattern: "*.md", base: "data/stories" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
  }),
});

export const collections = { stories };
