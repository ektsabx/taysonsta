// Page-level restrictions (docs/bos/30 §6, doc 31 Phase 3): a path prefix can
// be limited to specific roles on top of module permissions. The super admin
// always passes; a path matching several rules must satisfy all of them.

export interface PageRule {
  prefix: string;
  role_keys: string[];
}

export function pageAllowed(rules: PageRule[], pathname: string, roleKeys: string[], isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return rules
    .filter((r) => path === r.prefix || path.startsWith(`${r.prefix}/`))
    .every((r) => r.role_keys.some((k) => roleKeys.includes(k)));
}
