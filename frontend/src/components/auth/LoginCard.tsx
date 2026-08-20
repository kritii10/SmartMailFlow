import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";

export const LoginCard = () => {
  const { clearError, error, login } = useAuth();

  return (
    <section className="rounded-[30px] border border-white/12 bg-white/8 p-6 shadow-panel backdrop-blur md:p-8">
      <div className="rounded-[24px] border border-white/10 bg-white px-6 py-7 text-ink md:px-7 md:py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Secure Access
        </p>
        <h2 className="mt-3 font-serif text-3xl text-slate-900">Sign in to continue</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Access your dashboard, review scheduled campaigns, and manage outbound delivery from one
          place.
        </p>

        <div className="mt-8">
          <Button className="w-full justify-center" onClick={login} size="lg">
            Continue with Google
          </Button>
        </div>

        {error ? (
          <div className="mt-5">
            <ErrorState
              action={
                <button
                  className="text-sm font-medium text-rose-900 underline decoration-rose-300 underline-offset-4"
                  onClick={clearError}
                  type="button"
                >
                  Dismiss message
                </button>
              }
              message={error}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
};
