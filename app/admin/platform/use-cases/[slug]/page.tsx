import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader } from "@/components/bos/ui";
import { SHOTS, getUseCase } from "@/services/yolias/use-cases";
import { UseCaseForm } from "./UseCaseForm";

export default async function UseCaseEditPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePermission("platform.manage");
  const { slug } = await params;
  const row = slug === "new" ? null : await getUseCase(slug);
  if (slug !== "new" && !row) notFound();
  return (
    <>
      <PageHeader title={slug === "new" ? "حالة جديدة" : "تعديل الحالة"} />
      <UseCaseForm slug={slug === "new" ? "" : slug} status={row?.status ?? "draft"} doc={(row?.doc ?? null) as never} meta={(row?.meta ?? {}) as never} shots={[...SHOTS]} />
    </>
  );
}
