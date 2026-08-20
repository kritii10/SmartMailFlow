import { Badge } from "../ui/Badge";

export const DashboardHero = () => (
  <section className="surface-panel overflow-hidden p-6 md:p-8">
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div>
        <Badge tone="warning">Frontend Foundation</Badge>
        <h2 className="mt-4 max-w-3xl font-serif text-3xl text-ink md:text-4xl">
          The routing, auth, and API layers are ready for the scheduling features that come next.
        </h2>
        <p className="mt-4 max-w-2xl text-sm text-ink/68 md:text-base">
          This pass focuses on reusable building blocks: authenticated routing, shared UI, typed services, and a dashboard shell that can absorb scheduling, lead upload, and analytics work without a rewrite.
        </p>
      </div>

      <div className="surface-muted p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-ink/48">What is included now</p>
        <ul className="mt-4 grid gap-3 text-sm text-ink/75">
          <li>Google session restoration through a shared auth context</li>
          <li>Protected dashboard routing with a dedicated login page</li>
          <li>Reusable UI primitives for forms, states, and tables</li>
          <li>Typed API services for auth and email endpoints</li>
        </ul>
      </div>
    </div>
  </section>
);
