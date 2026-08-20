import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";

export const LoginCard = () => {
  const { clearError, error, login } = useAuth();

  return (
    <section className="surface-dark overflow-hidden px-6 py-8 md:px-10 md:py-10">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-gold">ReachInbox Assignment</p>
          <h1 className="mt-4 max-w-2xl font-serif text-4xl text-sand md:text-5xl">
            Sign in to the scheduling workspace built for reliable delayed email delivery.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-sand/72">
            Google OAuth unlocks the dashboard, while BullMQ, PostgreSQL, Redis, and Ethereal power the production-oriented delivery pipeline behind it.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={login} size="lg">
              Continue with Google
            </Button>
            <Button
              className="border-white/15 bg-transparent text-sand hover:bg-white/10"
              onClick={clearError}
              size="lg"
              variant="ghost"
            >
              Clear message
            </Button>
          </div>

          {error ? (
            <div className="mt-6">
              <ErrorState message={error} />
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] bg-white/10 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-gold">Foundation included</p>
          <div className="mt-4 grid gap-4 text-sm text-sand/78">
            <div className="rounded-[22px] bg-white/8 p-4">
              Typed API services for auth and email resources
            </div>
            <div className="rounded-[22px] bg-white/8 p-4">
              Protected routing with session restoration on page load
            </div>
            <div className="rounded-[22px] bg-white/8 p-4">
              Shared UI primitives for tables, forms, states, and modal flows
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
