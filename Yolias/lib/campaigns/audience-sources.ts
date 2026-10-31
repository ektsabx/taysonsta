// Where a custom audience's people come from (D-272): shared by the audiences page and its actions.
export const CUSTOM_SOURCES = ["previous_campaign", "customers", "qualified", "meetings", "interested", "imported"] as const;
export type CustomSource = (typeof CUSTOM_SOURCES)[number];
