import { Navigate } from "react-router-dom";
import { LoginCard } from "../components/auth/LoginCard";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../hooks/useAuth";

export const LoginPage = () => {
  const { isAuthenticated, status } = useAuth();

  if (status === "loading") {
    return (
      <main className="page-shell">
        <div className="page-container">
          <section className="surface-dark px-6 py-8 md:px-10">
            <h1 className="font-serif text-4xl text-sand">ReachInbox</h1>
            <div className="mt-6">
              <Spinner label="Restoring your previous session..." />
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <section className="surface-dark overflow-hidden px-6 py-8 md:px-10 md:py-10 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.32em] text-gold/90">ReachInbox</p>
              <h1 className="mt-5 font-serif text-4xl leading-tight text-sand md:text-5xl md:leading-tight">
                Schedule outbound email with precision, visibility, and control.
              </h1>

              <blockquote className="mt-10 max-w-xl border-l border-white/18 pl-5 text-lg leading-8 text-sand/88">
                "Professional communication works best when timing is deliberate and execution is
                dependable."
              </blockquote>
            </div>

            <LoginCard />
          </div>
        </section>
      </div>
    </main>
  );
};
