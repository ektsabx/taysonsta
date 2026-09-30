import Image from "next/image";
import { storageUrl } from "@/lib/storage";
import type { ProposalContent, ProposalProjectSnapshot } from "@/types/proposal";
import "./proposal.css";

export interface ProposalDocumentProps {
  title: string;
  subtitle: string | null;
  clientName: string;
  clientCompany: string | null;
  content: ProposalContent;
  projects: ProposalProjectSnapshot[];
  isDraftPreview?: boolean;
}

// The ONE reusable template. Every proposal — draft preview or a live client
// page — renders through this exact component; only the props differ.
export function ProposalDocument({
  title,
  subtitle,
  clientName,
  clientCompany,
  content,
  projects,
  isDraftPreview,
}: ProposalDocumentProps) {
  return (
    <div className="proposal-doc">
      {isDraftPreview ? <div className="proposal-preview-banner">معاينة داخلية — هذا ليس ما تم نشره للعميل بعد</div> : null}

      <header className="proposal-header">
        <Image src={storageUrl("img/logo.png")} alt="Taysonsta" width={130} height={32} priority />
      </header>

      <main className="proposal-main">
        <section className="proposal-hero">
          <span className="proposal-eyebrow">TAYSONSTA PRODUCT STUDIO</span>
          <h1>{title}</h1>
          {subtitle ? <p className="proposal-subtitle">{subtitle}</p> : null}
          <p className="proposal-prepared-for">
            Prepared for <strong>{clientName}</strong>
            {clientCompany ? ` — ${clientCompany}` : ""}
          </p>
        </section>

        {content.overview ? (
          <Section title="Executive Summary">
            <RichText value={content.overview} />
          </Section>
        ) : null}

        {content.clientProblem || content.clientGoals ? (
          <Section title="The Opportunity">
            {content.clientProblem ? (
              <div className="proposal-subblock">
                <h3>Client Problem</h3>
                <RichText value={content.clientProblem} />
              </div>
            ) : null}
            {content.clientGoals ? (
              <div className="proposal-subblock">
                <h3>Client Goals</h3>
                <RichText value={content.clientGoals} />
              </div>
            ) : null}
          </Section>
        ) : null}

        {content.proposedSolution ? (
          <Section title="Proposed Solution">
            <RichText value={content.proposedSolution} />
          </Section>
        ) : null}

        {content.packages.length > 0 ? (
          <Section title="Investment Options">
            <div className="proposal-packages">
              {content.packages.map((pkg) => (
                <article className="proposal-package-card" key={pkg.id}>
                  <h3>{pkg.name}</h3>
                  {pkg.goal ? <p className="proposal-package-goal">{pkg.goal}</p> : null}
                  <div className="proposal-package-meta">
                    <div>
                      <span className="proposal-package-label">Investment</span>
                      <strong>{pkg.priceLabel}</strong>
                    </div>
                    {pkg.timelineLabel ? (
                      <div>
                        <span className="proposal-package-label">Timeline</span>
                        <strong>{pkg.timelineLabel}</strong>
                      </div>
                    ) : null}
                  </div>
                  {pkg.paymentMilestones.length > 0 ? (
                    <div className="proposal-subblock">
                      <h4>Payment Schedule</h4>
                      <table className="proposal-milestones">
                        <tbody>
                          {pkg.paymentMilestones.map((m) => (
                            <tr key={m.id}>
                              <td>{m.label}</td>
                              <td>{m.percentage}</td>
                              <td>{m.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {pkg.scope.length > 0 ? (
                    <div className="proposal-subblock">
                      <h4>Scope</h4>
                      <ul>
                        {pkg.scope.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {pkg.deliverables.length > 0 ? (
                    <div className="proposal-subblock">
                      <h4>Deliverables</h4>
                      <ul>
                        {pkg.deliverables.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {pkg.excludes.length > 0 ? (
                    <div className="proposal-subblock">
                      <h4>Does NOT Include</h4>
                      <ul className="proposal-excludes">
                        {pkg.excludes.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {pkg.roadmap.length > 0 ? (
                    <div className="proposal-subblock">
                      <h4>Platform Capability Roadmap — Beyond Current Scope</h4>
                      <ul className="proposal-excludes">
                        {pkg.roadmap.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </Section>
        ) : null}

        {projects.length > 0 ? (
          <Section title="Relevant Work">
            <div className="proposal-projects">
              {projects.map((project) => (
                <article className="proposal-project-card" key={project.id}>
                  {project.featuredImage ? (
                    <div className="proposal-project-image">
                      <Image src={storageUrl(project.featuredImage)} alt={project.title} fill sizes="280px" />
                    </div>
                  ) : null}
                  <div className="proposal-project-body">
                    <strong>{project.title}</strong>
                    {project.industry ? <span className="proposal-project-industry">{project.industry}</span> : null}
                    {project.shortDescription ? <p>{project.shortDescription}</p> : null}
                    {project.metrics.length > 0 ? (
                      <div className="proposal-project-metrics">
                        {project.metrics.map((m, i) => (
                          <div key={i}>
                            <strong>{m.valueDisplay}</strong>
                            <span>{m.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </Section>
        ) : null}

        {content.paymentTerms ? (
          <Section title="Payment Terms">
            <RichText value={content.paymentTerms} />
          </Section>
        ) : null}

        {content.nextSteps ? (
          <Section title="Next Steps">
            <RichText value={content.nextSteps} />
          </Section>
        ) : null}
      </main>

      <footer className="proposal-footer">
        {content.closingNote ? <p>{content.closingNote}</p> : null}
        <p className="proposal-footer-brand">Taysonsta Product Studio · Confidential &amp; Proprietary</p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="proposal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function RichText({ value }: { value: string }) {
  const paragraphs = value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ whiteSpace: "pre-line" }}>
          {p}
        </p>
      ))}
    </>
  );
}
