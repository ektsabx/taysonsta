// Shape of `proposals.content` / `proposals.published_content` (jsonb).
// Sections mirror the real Taysonsta proposal document: an executive summary,
// problem/goals framing, one or more priced packages (the doc's "Options"),
// payment terms and next steps.

export interface ProposalPaymentMilestone {
  id: string;
  label: string;
  percentage: string;
  amount: string;
}

export interface ProposalPackage {
  id: string;
  name: string;
  goal: string;
  priceLabel: string;
  timelineLabel: string;
  scope: string[];
  deliverables: string[];
  excludes: string[];
  roadmap: string[];
  paymentMilestones: ProposalPaymentMilestone[];
}

export interface ProposalContent {
  overview: string;
  clientProblem: string;
  clientGoals: string;
  proposedSolution: string;
  packages: ProposalPackage[];
  paymentTerms: string;
  nextSteps: string;
  closingNote: string;
}

export const emptyProposalContent: ProposalContent = {
  overview: "",
  clientProblem: "",
  clientGoals: "",
  proposedSolution: "",
  packages: [],
  paymentTerms: "",
  nextSteps: "",
  closingNote:
    "This proposal contains confidential business, product, technical, and commercial information prepared specifically for the intended recipient.",
};

export function emptyProposalPackage(): ProposalPackage {
  return {
    id: crypto.randomUUID(),
    name: "",
    goal: "",
    priceLabel: "",
    timelineLabel: "",
    scope: [],
    deliverables: [],
    excludes: [],
    roadmap: [],
    paymentMilestones: [],
  };
}

export function emptyPaymentMilestone(): ProposalPaymentMilestone {
  return { id: crypto.randomUUID(), label: "", percentage: "", amount: "" };
}

export interface ProposalProjectSnapshot {
  id: string;
  slug: string;
  title: string;
  clientName: string | null;
  shortDescription: string | null;
  industry: string | null;
  services: string[];
  featuredImage: string | null;
  metrics: { label: string; valueDisplay: string }[];
}

export function parseProposalContent(value: unknown): ProposalContent {
  if (!value || typeof value !== "object") {
    return { ...emptyProposalContent, packages: [] };
  }
  const raw = value as Partial<Record<keyof ProposalContent, unknown>>;
  const packages = Array.isArray(raw.packages)
    ? (raw.packages as unknown[]).map((p) => normalizePackage(p))
    : [];

  return {
    overview: typeof raw.overview === "string" ? raw.overview : "",
    clientProblem: typeof raw.clientProblem === "string" ? raw.clientProblem : "",
    clientGoals: typeof raw.clientGoals === "string" ? raw.clientGoals : "",
    proposedSolution: typeof raw.proposedSolution === "string" ? raw.proposedSolution : "",
    packages,
    paymentTerms: typeof raw.paymentTerms === "string" ? raw.paymentTerms : "",
    nextSteps: typeof raw.nextSteps === "string" ? raw.nextSteps : "",
    closingNote: typeof raw.closingNote === "string" ? raw.closingNote : emptyProposalContent.closingNote,
  };
}

function normalizePackage(value: unknown): ProposalPackage {
  const raw = (value ?? {}) as Partial<Record<keyof ProposalPackage, unknown>>;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === "string" ? raw.name : "",
    goal: typeof raw.goal === "string" ? raw.goal : "",
    priceLabel: typeof raw.priceLabel === "string" ? raw.priceLabel : "",
    timelineLabel: typeof raw.timelineLabel === "string" ? raw.timelineLabel : "",
    scope: Array.isArray(raw.scope) ? raw.scope.filter((s): s is string => typeof s === "string") : [],
    deliverables: Array.isArray(raw.deliverables)
      ? raw.deliverables.filter((s): s is string => typeof s === "string")
      : [],
    excludes: Array.isArray(raw.excludes) ? raw.excludes.filter((s): s is string => typeof s === "string") : [],
    roadmap: Array.isArray(raw.roadmap) ? raw.roadmap.filter((s): s is string => typeof s === "string") : [],
    paymentMilestones: Array.isArray(raw.paymentMilestones)
      ? (raw.paymentMilestones as unknown[]).map((m) => normalizeMilestone(m))
      : [],
  };
}

function normalizeMilestone(value: unknown): ProposalPaymentMilestone {
  const raw = (value ?? {}) as Partial<Record<keyof ProposalPaymentMilestone, unknown>>;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    label: typeof raw.label === "string" ? raw.label : "",
    percentage: typeof raw.percentage === "string" ? raw.percentage : "",
    amount: typeof raw.amount === "string" ? raw.amount : "",
  };
}

export function parseProjectsSnapshot(value: unknown): ProposalProjectSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value as ProposalProjectSnapshot[];
}

export interface ProposalValidationError {
  field: string;
  message: string;
}

// Minimum publishable proposal: a title, an overview, and at least one
// package with a name and a stated price. Everything else (problem/goals,
// selected projects, payment terms) is optional narrative.
export function validateProposalForPublish(params: {
  title: string;
  content: ProposalContent;
  hasAccess: boolean;
}): ProposalValidationError[] {
  const errors: ProposalValidationError[] = [];

  if (!params.title.trim()) {
    errors.push({ field: "title", message: "عنوان المقترح مطلوب" });
  }
  if (!params.content.overview.trim()) {
    errors.push({ field: "overview", message: "الملخص التنفيذي مطلوب" });
  }
  if (params.content.packages.length === 0) {
    errors.push({ field: "packages", message: "أضف باقة واحدة على الأقل بسعر واضح" });
  } else {
    params.content.packages.forEach((pkg, index) => {
      if (!pkg.name.trim()) {
        errors.push({ field: `packages.${index}.name`, message: `اسم الباقة رقم ${index + 1} مطلوب` });
      }
      if (!pkg.priceLabel.trim()) {
        errors.push({ field: `packages.${index}.priceLabel`, message: `سعر الباقة "${pkg.name || index + 1}" مطلوب` });
      }
    });
  }
  if (!params.hasAccess) {
    errors.push({ field: "access", message: "أنشئ بيانات دخول العميل قبل النشر" });
  }

  return errors;
}
