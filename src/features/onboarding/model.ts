export const setupSteps = [
  { id: "boutique", label: "Your boutique" },
  { id: "garments", label: "Garments" },
  { id: "teams", label: "Employee teams" },
  { id: "flows", label: "Production flows" },
  { id: "review", label: "Review setup" },
] as const;

export type SetupStep = (typeof setupSteps)[number]["id"];

export const businessTypes = [
  "Made-to-measure",
  "Ready-to-wear",
  "Alterations",
  "Mixed boutique",
] as const;
export const openingDays = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
export const starterStages = [
  "Confirm details",
  "Cutting",
  "Stitching",
  "Finishing",
  "Quality check",
];
export const suggestedGarments = [
  "Kurta",
  "Blouse",
  "Dress",
  "Shirt",
  "Trousers",
  "Lehenga",
];
