import type { DecisionMaker, GccResident, InvestmentReadiness } from "@/types/database";

export type StartTiming = "immediately" | "within_30_days" | "within_1_3_months" | "exploring";

export interface QualificationInput {
  gccResident: GccResident;
  decisionMaker: DecisionMaker;
  investmentReadiness: InvestmentReadiness;
  startTiming: StartTiming;
}

export function isQualified(input: QualificationInput): boolean {
  const gccOk = input.gccResident === "yes";
  const decisionMakerOk = input.decisionMaker === "yes" || input.decisionMaker === "partner";
  const investmentOk = input.investmentReadiness === "ready";
  const startOk = input.startTiming === "immediately" || input.startTiming === "within_30_days";

  return gccOk && decisionMakerOk && investmentOk && startOk;
}
