"use client";

import { Tx } from "@/components/bos/I18n";

import { useActionState, useState } from "react";
import type { ProposalContent, ProposalPackage, ProposalPaymentMilestone } from "@/types/proposal";
import { emptyProposalPackage, emptyPaymentMilestone } from "@/types/proposal";
import type { CaseStudy } from "@/services/case-studies-admin";
import { saveProposalAction, type FormState } from "../../actions";

const initialState: FormState = { error: null };

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function MilestonesEditor({
  milestones,
  onChange,
}: {
  milestones: ProposalPaymentMilestone[];
  onChange: (next: ProposalPaymentMilestone[]) => void;
}) {
  function updateMilestone(index: number, next: ProposalPaymentMilestone) {
    onChange(milestones.map((m, i) => (i === index ? next : m)));
  }

  function removeMilestone(index: number) {
    onChange(milestones.filter((_, i) => i !== index));
  }

  return (
    <div className="admin-field">
      <label><Tx>جدول الدفعات (Payment Schedule)</Tx></label>
      {milestones.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "rgba(var(--bos-fg-rgb), 0.45)", marginBottom: 8 }}><Tx>لا يوجد دفعات محددة لهذه الباقة بعد.</Tx></p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {milestones.map((m, index) => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
              <input
                value={m.label}
                onChange={(e) => updateMilestone(index, { ...m, label: e.target.value })}
                placeholder="Start — توقيع الاتفاق"
              />
              <input
                value={m.percentage}
                onChange={(e) => updateMilestone(index, { ...m, percentage: e.target.value })}
                placeholder="40%"
              />
              <input
                value={m.amount}
                onChange={(e) => updateMilestone(index, { ...m, amount: e.target.value })}
                placeholder="$10,000"
              />
              <button type="button" className="admin-btn danger" onClick={() => removeMilestone(index)}>
                <Tx>حذف</Tx>
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="admin-btn secondary" onClick={() => onChange([...milestones, emptyPaymentMilestone()])}>
        <Tx>+ إضافة دفعة</Tx>
      </button>
    </div>
  );
}

function PackageEditor({
  pkg,
  onChange,
  onRemove,
}: {
  pkg: ProposalPackage;
  onChange: (next: ProposalPackage) => void;
  onRemove: () => void;
}) {
  return (
    <div className="admin-card" style={{ background: "#0d0d0d" }}>
      <div className="admin-title-row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}><Tx>{pkg.name || "باقة بدون اسم"}</Tx></h2>
        <button type="button" className="admin-btn danger" onClick={onRemove}>
          <Tx>حذف الباقة</Tx>
        </button>
      </div>
      <div className="admin-grid-2">
        <div className="admin-field">
          <label><Tx>اسم الباقة</Tx></label>
          <input value={pkg.name} onChange={(e) => onChange({ ...pkg, name: e.target.value })} placeholder="Chatwoot + Custom Features" />
        </div>
        <div className="admin-field">
          <label><Tx>الهدف</Tx></label>
          <input value={pkg.goal} onChange={(e) => onChange({ ...pkg, goal: e.target.value })} placeholder="إضافة Business Automation" />
        </div>
        <div className="admin-field">
          <label><Tx>السعر</Tx></label>
          <input
            value={pkg.priceLabel}
            onChange={(e) => onChange({ ...pkg, priceLabel: e.target.value })}
            placeholder="$12,000 — Starting from"
          />
        </div>
        <div className="admin-field">
          <label><Tx>المدة الزمنية</Tx></label>
          <input
            value={pkg.timelineLabel}
            onChange={(e) => onChange({ ...pkg, timelineLabel: e.target.value })}
            placeholder="4–6 Weeks"
          />
        </div>
      </div>
      <MilestonesEditor
        milestones={pkg.paymentMilestones}
        onChange={(paymentMilestones) => onChange({ ...pkg, paymentMilestones })}
      />
      <div className="admin-field">
        <label><Tx>النطاق (Scope) — سطر لكل بند</Tx></label>
        <textarea
          value={pkg.scope.join("\n")}
          onChange={(e) => onChange({ ...pkg, scope: linesToList(e.target.value) })}
        />
      </div>
      <div className="admin-field">
        <label><Tx>المخرجات (Deliverables) — سطر لكل بند</Tx></label>
        <textarea
          value={pkg.deliverables.join("\n")}
          onChange={(e) => onChange({ ...pkg, deliverables: linesToList(e.target.value) })}
        />
      </div>
      <div className="admin-field">
        <label><Tx>لا تشمل (Does NOT include) — سطر لكل بند</Tx></label>
        <textarea
          value={pkg.excludes.join("\n")}
          onChange={(e) => onChange({ ...pkg, excludes: linesToList(e.target.value) })}
        />
      </div>
      <div className="admin-field">
        <label><Tx>خارطة الطريق المستقبلية (Roadmap — Beyond Current Scope) — سطر لكل بند</Tx></label>
        <textarea
          value={pkg.roadmap.join("\n")}
          onChange={(e) => onChange({ ...pkg, roadmap: linesToList(e.target.value) })}
        />
      </div>
    </div>
  );
}

export function ProposalContentForm({
  proposalId,
  initialTitle,
  initialSubtitle,
  initialContent,
  caseStudies,
  initialSelectedProjectIds,
}: {
  proposalId: string;
  initialTitle: string;
  initialSubtitle: string;
  initialContent: ProposalContent;
  caseStudies: CaseStudy[];
  initialSelectedProjectIds: string[];
}) {
  const boundAction = saveProposalAction.bind(null, proposalId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [content, setContent] = useState<ProposalContent>(initialContent);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedProjectIds));

  function updatePackage(index: number, next: ProposalPackage) {
    setContent((c) => ({ ...c, packages: c.packages.map((p, i) => (i === index ? next : p)) }));
  }

  function removePackage(index: number) {
    setContent((c) => ({ ...c, packages: c.packages.filter((_, i) => i !== index) }));
  }

  function addPackage() {
    setContent((c) => ({ ...c, packages: [...c.packages, emptyProposalPackage()] }));
  }

  function toggleProject(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="subtitle" value={subtitle} />
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      {Array.from(selectedIds).map((id) => (
        <input key={id} type="hidden" name="projectIds" value={id} />
      ))}

      <div className="admin-card">
        <h2>Step 1 — Basic Information</h2>
        <div className="admin-field">
          <label><Tx>عنوان المقترح</Tx></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="admin-field">
          <label><Tx>عنوان فرعي</Tx></label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>
      </div>

      <div className="admin-card">
        <h2>Step 2 — Proposal Content</h2>
        <div className="admin-field">
          <label><Tx>الملخص التنفيذي (Executive Summary)</Tx></label>
          <textarea value={content.overview} onChange={(e) => setContent({ ...content, overview: e.target.value })} required />
        </div>
        <div className="admin-field">
          <label><Tx>مشكلة العميل (Client Problem)</Tx></label>
          <textarea value={content.clientProblem} onChange={(e) => setContent({ ...content, clientProblem: e.target.value })} />
        </div>
        <div className="admin-field">
          <label><Tx>أهداف العميل (Client Goals)</Tx></label>
          <textarea value={content.clientGoals} onChange={(e) => setContent({ ...content, clientGoals: e.target.value })} />
        </div>
        <div className="admin-field">
          <label><Tx>الحل المقترح (Proposed Solution)</Tx></label>
          <textarea
            value={content.proposedSolution}
            onChange={(e) => setContent({ ...content, proposedSolution: e.target.value })}
          />
        </div>
        <div className="admin-field">
          <label><Tx>شروط الدفع (Payment Terms)</Tx></label>
          <textarea value={content.paymentTerms} onChange={(e) => setContent({ ...content, paymentTerms: e.target.value })} />
        </div>
        <div className="admin-field">
          <label><Tx>الخطوات القادمة (Next Steps)</Tx></label>
          <textarea value={content.nextSteps} onChange={(e) => setContent({ ...content, nextSteps: e.target.value })} />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-title-row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}><Tx>الباقات / خيارات الاستثمار (Packages)</Tx></h2>
          <button type="button" className="admin-btn secondary" onClick={addPackage}>
            <Tx>+ إضافة باقة</Tx>
          </button>
        </div>
        {content.packages.length === 0 ? (
          <div className="admin-empty"><Tx>أضف باقة واحدة على الأقل تحتوي على السعر قبل النشر.</Tx></div>
        ) : null}
        {content.packages.map((pkg, index) => (
          <PackageEditor key={pkg.id} pkg={pkg} onChange={(next) => updatePackage(index, next)} onRemove={() => removePackage(index)} />
        ))}
      </div>

      <div className="admin-card">
        <h2>Step 3 — Selected Projects</h2>
        {caseStudies.length === 0 ? (
          <div className="admin-empty"><Tx>لا يوجد case studies بعد.</Tx></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {caseStudies.map((cs) => {
              const checked = selectedIds.has(cs.id);
              return (
                <label
                  key={cs.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    background: "#0d0d0d",
                    border: `1px solid ${checked ? "var(--red, #e51f26)" : "rgba(var(--bos-fg-rgb), 0.08)"}`,
                    borderRadius: 10,
                    padding: 12,
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleProject(cs.id)} style={{ marginTop: 3 }} />
                  <div>
                    <strong style={{ display: "block", fontSize: 13.5 }}><Tx>{cs.title}</Tx></strong>
                    <span style={{ fontSize: 12, color: "rgba(var(--bos-fg-rgb), 0.5)" }}>
                      {cs.client_name ?? ""} {cs.industry_ar ? `· ${cs.industry_ar}` : ""}
                    </span>
                    {cs.status === "draft" ? <div className="admin-badge draft" style={{ marginTop: 6 }}><Tx>مسودة</Tx></div> : null}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {state.error ? <p className="admin-error"><Tx>{state.error}</Tx></p> : null}

      <button type="submit" className="admin-btn" disabled={pending}>
        <Tx>{pending ? "جارِ الحفظ..." : "حفظ المقترح"}</Tx>
      </button>
    </form>
  );
}
