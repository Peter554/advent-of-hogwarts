import { getCollection } from "astro:content";

const getBuildDate = () => {
  const hookBody = process.env.INCOMING_HOOK_BODY;
  if (hookBody) {
    return new Date(hookBody.trim()).toISOString().slice(0, 10);
  } else {
    // Use sv-SE locale to get YYYY-MM-DD format.
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
    });
    return formatter.format(new Date());
  }
};

export const getYear = (date: string) => date.slice(0, 4);

export const getStories = async (year?: string) => {
  const buildDate = getBuildDate();

  const stories = (await getCollection("stories"))
    .map((story) => {
      return {
        ...story,
        data: {
          ...story.data,
          year: getYear(story.data.date),
          locked: story.data.date > buildDate,
        },
      };
    })
    .filter((story) => year === undefined || story.data.year === year);

  return stories.toSorted((a, b) => {
    return a.data.date > b.data.date ? +1 : -1;
  });
};

/** Every year that has at least one story (locked or not), newest first. */
export const getYears = async () => {
  const years = new Set((await getStories()).map((story) => story.data.year));
  return [...years].toSorted().toReversed();
};

export const getLatestYear = async () => (await getYears())[0];

export const getDayNumber = (date: string) => {
  return new Date(date + "T00:00:00").getDate();
};

export const getStoryUrl = (date: string) =>
  `/${getYear(date)}/stories/${date}/`;

export default {
  getStories,
  getYears,
  getLatestYear,
  getYear,
  getDayNumber,
  getStoryUrl,
};
