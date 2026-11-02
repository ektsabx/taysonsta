// Where a custom audience's people come from (D-272, D-273): shared by the Audiences page and its actions.
export const CUSTOM_SOURCES = ["previous_campaign", "customers", "meetings", "interested", "imported"] as const;
export type CustomSource = (typeof CUSTOM_SOURCES)[number];
