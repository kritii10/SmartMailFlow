import type { PropsWithChildren, ReactNode } from "react";

type PageSectionProps = PropsWithChildren<{
  title: string;
  description?: string;
  action?: ReactNode;
}>;

export const PageSection = ({ action, children, description, title }: PageSectionProps) => (
  <section className="surface-panel p-6">
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="font-serif text-2xl text-ink">{title}</h2>
        {description ? <p className="mt-2 text-sm text-ink/62">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    {children}
  </section>
);
