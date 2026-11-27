import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const stories = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "src/data/stories" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.string(),
      image: image(),
    }),
});

export const collections = { stories };
