import { getCollection } from "astro:content";

const getBuildDate = () => {
  const hookBody = process.env.INCOMING_HOOK_BODY;
  if (hookBody) {
    return new Date(hookBody.trim()).toISOString().split("T")[0];
  } else {
    // Use sv-SE locale to get YYYY-MM-DD format.
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
    });
    return formatter.format(new Date());
  }
};

export const getStories = async () => {
  const buildDate = getBuildDate();

  const stories = (await getCollection("stories")).map((story) => {
    return {
      ...story,
      data: {
        ...story.data,
        locked: story.data.date > buildDate,
      },
    };
  });

  return stories.toSorted((a, b) => {
    return a.data.date > b.data.date ? +1 : -1;
  });
};

export const getDayNumber = (date: string) => {
  return new Date(date + "T00:00:00").getDate();
};

export default { getStories, getDayNumber };
