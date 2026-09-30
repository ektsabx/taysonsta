import "server-only";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { entityHref, entityTypeLabels } from "@/lib/bos/links";
import type { PermissionKey } from "@/lib/bos/permissions";

const moduleOf: Record<string, string> = {
  lead: "leads", contact: "contacts", client: "clients", deal: "deals", project: "projects", task: "tasks",
  file: "files", ticket: "tickets", kb_article: "knowledge",
  // Phase 17 (docs/bos/30 §26)
  employee: "employees", invoice: "invoices", expense: "expenses", meeting: "meetings", document: "documents", conversation: "conversations",
};

export const searchTypes = Object.keys(moduleOf);

export interface SearchHit {
  type: string;
  typeLabel: string;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

// Global search grouped by entity type (§64); every hit is permission-checked.
export async function globalSearch(bos: BosUser, q: string, perType = 6, onlyType?: string): Promise<SearchHit[]> {
  const types = Object.keys(moduleOf).filter((t) => bos.permissions.has(`${moduleOf[t]}.read` as PermissionKey) && (!onlyType || t === onlyType));
  if (!types.length) return [];
  const { data } = await db().rpc("bos_search", { p_q: q, p_types: types, p_limit: perType });
  const hits: SearchHit[] = [];
  for (const row of (data ?? []) as { entity_type: string; id: string; title: string; subtitle: string | null; owner_id: string | null }[]) {
    let allowed: boolean;
    if (row.entity_type === "file") {
      const { data: f } = await db().from("files").select("entity_type, entity_id, uploaded_by").eq("id", row.id).maybeSingle();
      allowed = !!f && (f.uploaded_by === bos.userId || (!!f.entity_type && !!f.entity_id && (await canAccessEntity(bos, f.entity_type, f.entity_id))));
    } else if (row.entity_type === "document") {
      // A document is visible with access to its source record (same rule as the document page).
      const { data: d } = await db().from("generated_documents").select("entity_type, entity_id").eq("id", row.id).maybeSingle();
      allowed = !!d && (bos.isSuperAdmin || (await canAccessEntity(bos, d.entity_type, d.entity_id)));
    } else if (row.entity_type === "conversation") {
      const scope = bos.permissions.get("conversations.read");
      allowed = scope === "all" || row.owner_id === bos.userId;
    } else if (row.entity_type === "kb_article") {
      allowed = await canAccessEntity(bos, "kb_article", row.id);
    } else {
      allowed = bos.permissions.get(`${moduleOf[row.entity_type]}.read` as PermissionKey) === "all" || (await canAccessEntity(bos, row.entity_type, row.id));
    }
    if (!allowed) continue;
    hits.push({
      type: row.entity_type,
      typeLabel: entityTypeLabels[row.entity_type] ?? row.entity_type,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      href: row.entity_type === "kb_article" ? `/admin/knowledge/articles/${(await db().from("kb_articles").select("slug").eq("id", row.id).maybeSingle()).data?.slug ?? row.id}` : entityHref(row.entity_type, row.id) ?? "#",
    });
  }
  return hits;
}

export type SearchableType = "client" | "contact" | "deal" | "project" | "lead" | "user" | "product" | "vendor" | "ticket" | "task";

function like(q: string) {
  return `%${q.replace(/[%_,()]/g, " ").trim()}%`;
}

// Options for EntitySelector; restricted to records the user may read.
export async function searchEntityOptions(bos: BosUser, type: SearchableType, q: string, filter?: Record<string, string>) {
  const client = db();
  const pattern = like(q);
  const limit = 12;
  switch (type) {
    case "client": {
      if (!bos.permissions.has("clients.read")) return [];
      let query = client.from("clients").select("id, name, company_name, email").is("archived_at", null).order("name").limit(limit);
      if (q) query = query.or(`name.ilike.${pattern},company_name.ilike.${pattern},email.ilike.${pattern}`);
      const { data } = await query;
      return (data ?? []).map((c) => ({ id: c.id, label: c.company_name ? `${c.company_name}` : c.name, sub: c.company_name ? `${c.name} · ${c.email}` : c.email }));
    }
    case "contact": {
      if (!bos.permissions.has("contacts.read")) return [];
      let query = client.from("contacts").select("id, full_name, email, position, client_id").is("archived_at", null).order("full_name").limit(limit);
      if (filter?.client_id) query = query.eq("client_id", filter.client_id);
      if (q) query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
      const { data } = await query;
      return (data ?? []).map((c) => ({ id: c.id, label: c.full_name, sub: [c.position, c.email].filter(Boolean).join(" · ") }));
    }
    case "deal": {
      if (!bos.permissions.has("deals.read")) return [];
      let query = client.from("deals").select("id, name, deal_number, value, currency, client_id").is("archived_at", null).order("created_at", { ascending: false }).limit(limit * 2);
      if (filter?.client_id) query = query.eq("client_id", filter.client_id);
      if (q) query = query.or(`name.ilike.${pattern},deal_number.ilike.${pattern}`);
      const { data } = await query;
      const out = [];
      for (const d of data ?? []) {
        if (bos.permissions.get("deals.read") !== "all" && !(await canAccessEntity(bos, "deal", d.id))) continue;
        out.push({ id: d.id, label: d.name, sub: `${d.deal_number} · ${d.value} ${d.currency}` });
        if (out.length >= limit) break;
      }
      return out;
    }
    case "project": {
      if (!bos.permissions.has("projects.read")) return [];
      let query = client.from("projects").select("id, name, project_number, client_id").is("archived_at", null).order("created_at", { ascending: false }).limit(limit * 2);
      if (filter?.client_id) query = query.eq("client_id", filter.client_id);
      if (q) query = query.or(`name.ilike.${pattern},project_number.ilike.${pattern}`);
      const { data } = await query;
      const out = [];
      for (const p of data ?? []) {
        if (bos.permissions.get("projects.read") !== "all" && !(await canAccessEntity(bos, "project", p.id))) continue;
        out.push({ id: p.id, label: p.name, sub: p.project_number });
        if (out.length >= limit) break;
      }
      return out;
    }
    case "lead": {
      if (!bos.permissions.has("leads.read")) return [];
      let query = client.from("leads").select("id, name, company_name, lead_number").is("archived_at", null).order("created_at", { ascending: false }).limit(limit * 2);
      if (q) query = query.or(`name.ilike.${pattern},company_name.ilike.${pattern},email.ilike.${pattern}`);
      const { data } = await query;
      const out = [];
      for (const l of data ?? []) {
        if (bos.permissions.get("leads.read") !== "all" && !(await canAccessEntity(bos, "lead", l.id))) continue;
        out.push({ id: l.id, label: l.name, sub: [l.lead_number, l.company_name].filter(Boolean).join(" · ") });
        if (out.length >= limit) break;
      }
      return out;
    }
    case "user": {
      let query = client
        .from("employees")
        .select("user_id, full_name, position, email")
        .not("user_id", "is", null)
        .in("lifecycle_status", ["active", "onboarding", "on_leave", "pending_onboarding"])
        .order("full_name")
        .limit(limit);
      if (q) query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
      const { data } = await query;
      return (data ?? []).map((e) => ({ id: e.user_id!, label: e.full_name, sub: e.position ?? e.email }));
    }
    case "product": {
      let query = client.from("products").select("id, name, kind, default_price, currency").is("archived_at", null).eq("is_active", true).order("name").limit(limit);
      if (q) query = query.ilike("name", pattern);
      const { data } = await query;
      return (data ?? []).map((p) => ({ id: p.id, label: p.name, sub: `${p.kind === "service" ? "خدمة" : "منتج"}${p.default_price ? ` · ${p.default_price} ${p.currency ?? ""}` : ""}` }));
    }
    case "vendor": {
      if (!bos.permissions.has("vendors.read") && !bos.permissions.has("expenses.create")) return [];
      let query = client.from("vendors").select("id, name, type").is("archived_at", null).order("name").limit(limit);
      if (q) query = query.ilike("name", pattern);
      const { data } = await query;
      return (data ?? []).map((v) => ({ id: v.id, label: v.name, sub: v.type }));
    }
    case "ticket": {
      if (!bos.permissions.has("tickets.read")) return [];
      let query = client.from("tickets").select("id, subject, ticket_number").order("created_at", { ascending: false }).limit(limit * 2);
      if (filter?.client_id) query = query.eq("client_id", filter.client_id);
      if (q) query = query.or(`subject.ilike.${pattern},ticket_number.ilike.${pattern}`);
      const { data } = await query;
      const out = [];
      for (const t of data ?? []) {
        if (bos.permissions.get("tickets.read") !== "all" && !(await canAccessEntity(bos, "ticket", t.id))) continue;
        out.push({ id: t.id, label: t.subject, sub: t.ticket_number });
        if (out.length >= limit) break;
      }
      return out;
    }
    case "task": {
      if (!bos.permissions.has("tasks.read")) return [];
      let query = client.from("tasks").select("id, title, project_id").is("archived_at", null).order("created_at", { ascending: false }).limit(limit * 2);
      if (filter?.project_id) query = query.eq("project_id", filter.project_id);
      if (q) query = query.ilike("title", pattern);
      const { data } = await query;
      const out = [];
      for (const t of data ?? []) {
        if (bos.permissions.get("tasks.read") !== "all" && !(await canAccessEntity(bos, "task", t.id))) continue;
        out.push({ id: t.id, label: t.title, sub: null });
        if (out.length >= limit) break;
      }
      return out;
    }
    default:
      return [];
  }
}
