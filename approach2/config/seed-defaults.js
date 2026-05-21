const profiles = {
  small: { epics: 5, storiesPerEpic: 10, tasksPerStory: 2, members: 5 },
  medium: { epics: 25, storiesPerEpic: 30, tasksPerStory: 5, members: 20 },
  large: { epics: 50, storiesPerEpic: 50, tasksPerStory: 8, members: 40 },
};

const profileName = (process.env.SEED_PROFILE || 'medium').toLowerCase();
const profile = profiles[profileName] || profiles.medium;

export const SEED_PROFILE = profileName in profiles ? profileName : 'medium';
export const SEED_EPICS = Number(process.env.SEED_EPICS ?? profile.epics);
export const SEED_STORIES_PER_EPIC = Number(
  process.env.SEED_STORIES_PER_EPIC ?? profile.storiesPerEpic
);
export const SEED_TASKS_PER_STORY = Number(
  process.env.SEED_TASKS_PER_STORY ?? profile.tasksPerStory
);
export const SEED_MEMBERS = Number(process.env.SEED_MEMBERS ?? profile.members);
export const SEED_DELAY_MS = Number(process.env.SEED_DELAY_MS ?? 50);
