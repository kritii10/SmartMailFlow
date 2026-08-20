import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Spinner } from "../ui/Spinner";

export const ProtectedRoute = () => {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="page-shell">
        <div className="page-container">
          <div className="surface-dark px-6 py-8 md:px-8">
            <h1 className="font-serif text-4xl text-sand">Restoring your session</h1>
            <div className="mt-6">
              <Spinner label="Checking Google authentication..." />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <Outlet />;
};
