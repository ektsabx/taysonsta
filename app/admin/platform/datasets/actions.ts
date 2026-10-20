"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import {
  createDataset, deleteDataset, finishImport, stageBatch, startEnrichment, suggestMapping, updateLicense,
  type DatasetInput,
} from "@/services/yolias/datasets";
import type { DatasetEntity, DatasetMapping } from "../../../../Yolias/lib/datasets/normalize";

// Data import (D-248). Reading needs platform.read; importing, changing a
// licence and deleting need platform.manage (scope all). Every change is
// audited in the service.

const PATH = "/admin/platform/datasets";
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => (s(f, k) === "" ? null : Number(s(f, k)));

export async function suggestMappingAction(headers: string[], sample: string[][]): Promise<ActionState<{ mapping: DatasetMapping; entity: DatasetEntity; source: "ai" | "rules"; note: string | null }>> {
  return handleAction("yolias.datasets.mapping", async () => {
    const { bos } = await authorize("platform.manage", "all");
    if (!Array.isArray(headers) || !headers.length || headers.length > 300) throw new ValidationError("الملف بدون أعمدة.");
    return suggestMapping(bos, headers.map((h) => String(h).slice(0, 200)), (sample ?? []).slice(0, 8).map((r) => (r ?? []).slice(0, 300).map((c) => String(c ?? "").slice(0, 200))));
  });
}

export async function createDatasetAction(input: DatasetInput, file: { name: string; rows: number; headers: string[]; sample: string[][]; mapping: DatasetMapping; mappingSource: "ai" | "rules" | "manual"; entity: DatasetEntity }): Promise<ActionState<{ id: string }>> {
  return handleAction("yolias.datasets.create", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = await createDataset(bos, input, file);
    revalidatePath(PATH);
    return { id };
  });
}

export async function stageBatchAction(id: string, start: number, rows: string[][]): Promise<ActionState<{ staged: number; invalid: number; merged: number; remaining: number }>> {
  return handleAction("yolias.datasets.stage", async () => {
    await authorize("platform.manage", "all");
    return stageBatch(id, start, rows);
  });
}

export async function finishImportAction(id: string): Promise<ActionState<{ remaining: number }>> {
  return handleAction("yolias.datasets.finish", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const r = await finishImport(bos, id);
    revalidatePath(PATH);
    return r;
  });
}

export async function enrichAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.datasets.enrich", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await startEnrichment(bos, s(fd, "id"));
    revalidatePath(`${PATH}/${s(fd, "id")}`);
    return { ok: true };
  });
}

export async function licenseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.datasets.license", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = s(fd, "id");
    await updateLicense(bos, id, {
      name: s(fd, "name"), licenseName: s(fd, "license_name") || null, customerFacing: fd.get("customer_facing") === "on", redistributable: fd.get("redistributable") === "on",
      attribution: s(fd, "attribution") || null, retentionDays: n(fd, "retention_days"), notes: s(fd, "notes") || null, vendor: s(fd, "vendor") || null, sourceUrl: s(fd, "source_url") || null,
    });
    revalidatePath(`${PATH}/${id}`);
    return { ok: true };
  });
}

export async function deleteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.datasets.delete", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = s(fd, "id");
    const r = await deleteDataset(bos, id, s(fd, "confirm"));
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${id}`);
    return { ok: true, message: `حُذفت ${r.companies} شركة و${r.people} شخص و${r.values} قيمة.` };
  });
}

export async function openSourceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { redirect } = await import("next/navigation");
  const r = await handleAction("yolias.datasets.open_source", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const { runOpenSource } = await import("@/services/yolias/open-sources");
    const id = await runOpenSource(bos, s(fd, "source") as "osm" | "sirene" | "companies_house" | "common_crawl", fd);
    revalidatePath(PATH);
    return { ok: true, data: { id } } as ActionState<{ id: string }>;
  });
  if (r.ok && (r.data as { id?: string } | undefined)?.id) redirect(`${PATH}/${(r.data as { id: string }).id}`);
  return r;
}
