import type { Dictionary } from "@/lib/i18n/config";
import type { SettingsTab } from "./types";

// Settings search (owner brief 2026-10-20): every searchable setting points at
// the dictionary strings its row already shows, so the index never holds copy
// of its own and follows the interface language. `id` matches the row's
// data-setting attribute, which is where a result scrolls to.
interface Entry {
  tab: SettingsTab;
  id: string;
  label: (t: Dictionary) => string;
  desc?: (t: Dictionary) => string;
}

const S = (t: Dictionary) => t.settings;

const ENTRIES: Entry[] = [
  { tab: "general", id: "theme", label: (t) => S(t).general.theme, desc: (t) => S(t).general.themeDesc },
  { tab: "general", id: "text-size", label: (t) => S(t).general.textSize, desc: (t) => S(t).general.textSizeDesc },
  { tab: "general", id: "language", label: (t) => S(t).general.languages, desc: (t) => S(t).general.languagesDesc },
  { tab: "general", id: "timezone", label: (t) => S(t).general.timezone, desc: (t) => S(t).general.timezoneDesc },
  { tab: "general", id: "country", label: (t) => S(t).general.country, desc: (t) => S(t).general.countryDesc },
  { tab: "account", id: "avatar", label: (t) => S(t).account.avatar, desc: (t) => S(t).account.avatarDesc },
  { tab: "account", id: "full-name", label: (t) => S(t).account.fullName, desc: (t) => S(t).account.fullNameDesc },
  { tab: "account", id: "phone", label: (t) => S(t).account.phone, desc: (t) => S(t).account.phoneDesc },
  { tab: "account", id: "email", label: (t) => S(t).account.email, desc: (t) => S(t).account.emailDesc },
  { tab: "account", id: "two-factor", label: (t) => S(t).account.twoFactor, desc: (t) => S(t).account.twoFactorDesc },
  { tab: "account", id: "devices", label: (t) => S(t).account.devices, desc: (t) => `${S(t).account.devicesDesc} ${S(t).account.logoutAll}` },
  { tab: "account", id: "delete-account", label: (t) => S(t).account.deleteTitle, desc: (t) => S(t).account.deleteDesc },
  { tab: "notifications", id: "notify-discovery", label: (t) => S(t).notifications.discovery, desc: (t) => S(t).notifications.discoveryDesc },
  { tab: "notifications", id: "notify-usage", label: (t) => S(t).notifications.usage, desc: (t) => S(t).notifications.usageDesc },
  { tab: "notifications", id: "notify-billing", label: (t) => S(t).notifications.billing, desc: (t) => S(t).notifications.billingDesc },
  { tab: "notifications", id: "notify-product", label: (t) => S(t).notifications.product, desc: (t) => S(t).notifications.productDesc },
  { tab: "usage", id: "plan-usage", label: (t) => S(t).usage.title, desc: (t) => `${S(t).usage.prospects} ${S(t).usage.emails} ${S(t).usage.contacts}` },
  { tab: "usage", id: "buy-more", label: (t) => t.buyMore.title, desc: (t) => t.buyMore.lead },
  { tab: "billing", id: "plan", label: (t) => S(t).titles.billing, desc: (t) => `${S(t).billing.manageBilling} ${S(t).billing.upgrade}` },
  { tab: "billing", id: "payment", label: (t) => S(t).billing.payment },
  { tab: "billing", id: "invoices", label: (t) => S(t).billing.invoices },
  { tab: "billing", id: "cancellation", label: (t) => S(t).billing.cancellation, desc: (t) => `${S(t).billing.cancelPlan} ${S(t).billing.resume}` },
  { tab: "team", id: "members", label: (t) => S(t).team.members, desc: (t) => `${S(t).team.membersDesc} ${S(t).team.invite}` },
  { tab: "integration", id: "gmail", label: () => "Gmail", desc: (t) => S(t).integration.gmailDesc },
  { tab: "integration", id: "imap", label: (t) => S(t).integration.imap.name, desc: (t) => S(t).integration.imap.desc },
];

export interface SettingsHit { tab: SettingsTab; id: string; label: string; desc: string }

/** Case-, accent- and Arabic-letter-form-insensitive text for matching. */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "") // Latin accents, Arabic diacritics, tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Settings whose name, description or tab contain every word of the query
 * (partial words count). Name matches rank first, then tab, then description.
 */
export function searchSettings(query: string, t: Dictionary, tabs: readonly SettingsTab[]): SettingsHit[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const hits: { hit: SettingsHit; rank: number }[] = [];
  for (const e of ENTRIES) {
    if (!tabs.includes(e.tab)) continue;
    const label = e.label(t);
    const desc = e.desc?.(t) ?? "";
    const tabName = `${t.settings.tabs[e.tab]} ${t.settings.titles[e.tab]}`;
    const [l, d, g] = [normalize(label), normalize(desc), normalize(tabName)];
    if (!words.every((w) => l.includes(w) || d.includes(w) || g.includes(w))) continue;
    const rank = words.every((w) => l.includes(w)) ? (l.startsWith(words[0]) ? 0 : 1) : words.every((w) => l.includes(w) || g.includes(w)) ? 2 : 3;
    hits.push({ hit: { tab: e.tab, id: e.id, label, desc: e.desc ? descFor(e, t) : "" }, rank });
  }
  return hits.sort((a, b) => a.rank - b.rank).map((h) => h.hit);
}

// Results show the row's own description, not the extra words added for matching.
function descFor(e: Entry, t: Dictionary): string {
  const own: Record<string, (t: Dictionary) => string> = {
    devices: (t) => S(t).account.devicesDesc,
    "plan-usage": (t) => S(t).usage.prospectsDesc,
    plan: () => "",
    cancellation: () => "",
    members: (t) => S(t).team.membersDesc,
  };
  return (own[e.id] ?? e.desc ?? (() => ""))(t);
}
