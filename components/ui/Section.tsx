import type { ReactNode } from "react";

interface SectionProps {
  variant?: "light" | "dark";
  tag?: string;
  heading?: ReactNode;
  subtitle?: ReactNode;
  id?: string;
  children?: ReactNode;
}

export function Section({ variant = "light", tag, heading, subtitle, id, children }: SectionProps) {
  if (variant === "dark") {
    return (
      <div className="sec-dark" id={id}>
        <div className="sec-inner">
          <SectionHeader tag={tag} heading={heading} subtitle={subtitle} />
          {children}
        </div>
      </div>
    );
  }

  return (
    <section className="sec" id={id}>
      <SectionHeader tag={tag} heading={heading} subtitle={subtitle} />
      {children}
    </section>
  );
}

function SectionHeader({ tag, heading, subtitle }: Pick<SectionProps, "tag" | "heading" | "subtitle">) {
  if (!tag && !heading && !subtitle) {
    return null;
  }

  return (
    <>
      {tag ? <div className="sec-tag">{tag}</div> : null}
      {heading ? <h2 className="sec-h2">{heading}</h2> : null}
      {subtitle ? <p className="sec-p">{subtitle}</p> : null}
    </>
  );
}
