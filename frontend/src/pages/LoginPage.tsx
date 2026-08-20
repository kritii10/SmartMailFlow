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
            <h1 className="font-serif text-4xl text-sand">ReachInbox Workspace</h1>
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
      <div className="page-container grid gap-6">
        <LoginCard />
      </div>
    </main>
  );
};
