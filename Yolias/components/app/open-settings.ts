import type { SettingsTab } from "./types";

// Any client component can open a settings tab (e.g. Usage from a "Buy more
// prospects" button); AppShell listens and opens the modal.
export const OPEN_SETTINGS_EVENT = "yolias:open-settings";

export function openSettingsTab(tab: SettingsTab) {
  window.dispatchEvent(new CustomEvent<SettingsTab>(OPEN_SETTINGS_EVENT, { detail: tab }));
}
