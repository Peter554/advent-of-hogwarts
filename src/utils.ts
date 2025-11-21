import { Glob } from "bun";

const defaultAsOf = () => {
  const hookBody = process.env.INCOMING_HOOK_BODY;
  if (hookBody) {
    return hookBody.trim();
  }
  return new Date().toISOString().split("T")[0];
};

export const getStories = async (as_of: string | undefined = undefined) => {
  as_of = as_of || defaultAsOf();

  const files = await Array.fromAsync(
    new Glob("**/*.md").scan({
      cwd: "data/stories",
      absolute: true,
    }),
  );

  const stories = (
    await Promise.all(
      files.map(async (path) => {
        const text = await Bun.file(path).text();
        const pathParts = path.split("/");
        const date = pathParts[pathParts.length - 1]!.replace(".md", "");
        return {
          text,
          date,
        };
      }),
    )
  ).filter((story) => story.date <= as_of);

  return stories.toSorted((a, b) => {
    return b.date > a.date ? +1 : -1;
  });
};

export default { getStories };
