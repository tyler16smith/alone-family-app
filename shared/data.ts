import type { Location } from "./types.js";

// Family roster: names shown on the phone's "Select your name" screen, with preset bios/skills.
// Edit this list, then redeploy. Anyone not on it can tap "I'm not on the list".
export const ROSTER: { name: string; bio: string; skills?: string }[] = [
  // { name: "Grandpa Joe", bio: "Retired farmer, has never once been cold.", skills: "Fixes anything with baling wire." },
];

export const QUICK_ITEMS = [
  "Knife",
  "Ferro rod",
  "Tarp",
  "Gill net",
  "Bow & arrows",
  "Cooking pot",
  "Sleeping bag",
  "Axe",
  "Fishing line & hooks",
  "Saw",
];

export const MAX_ITEMS = 10;
export const MAX_TEXT = 400;

export const LOCATIONS: Location[] = [
  {
    id: "vancouver-island",
    name: "Vancouver Island, BC",
    blurb: "Rainforest coast. Mild but endlessly wet; shellfish if you know where to look.",
    cold: 4, wet: 9, foodAbundance: 6, predators: 6, predatorName: "black bears and cougars",
  },
  {
    id: "mongolia",
    name: "Northern Mongolia",
    blurb: "Open taiga and frozen rivers. Bitter cold, scarce game, wolves.",
    cold: 9, wet: 3, foodAbundance: 3, predators: 7, predatorName: "wolves",
  },
  {
    id: "patagonia",
    name: "Patagonia, Argentina",
    blurb: "Wind-scoured lakes and lenga forest. Trout in the lake, pumas in the hills.",
    cold: 6, wet: 5, foodAbundance: 5, predators: 6, predatorName: "pumas",
  },
  {
    id: "great-slave-lake",
    name: "Great Slave Lake, NWT",
    blurb: "Subarctic boreal shoreline. Fishing is life; winter comes fast.",
    cold: 8, wet: 5, foodAbundance: 6, predators: 7, predatorName: "black bears and wolves",
  },
  {
    id: "labrador",
    name: "Labrador, Canada",
    blurb: "Rocky fjords and bogs. Brutal weather, polar bears possible on the coast.",
    cold: 8, wet: 8, foodAbundance: 4, predators: 8, predatorName: "black bears and polar bears",
  },
  {
    id: "chilko-lake",
    name: "Chilko Lake, BC",
    blurb: "Glacial lake under big mountains. Grizzly country; salmon run if you're lucky.",
    cold: 6, wet: 5, foodAbundance: 5, predators: 9, predatorName: "grizzly bears",
  },
];
