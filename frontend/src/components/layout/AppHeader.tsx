import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/Button";

export const AppHeader = () => {
  const { logout, user } = useAuth();
  const [showAvatarImage, setShowAvatarImage] = useState(Boolean(user?.avatar));

  useEffect(() => {
    setShowAvatarImage(Boolean(user?.avatar));
  }, [user?.avatar]);

  if (!user) {
    return null;
  }

  return (
    <header className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
            R
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">ReachInbox</p>
            <p className="text-sm text-slate-500">Outbound operations</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <nav className="hidden sm:block">
            <NavLink
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`
              }
              to="/dashboard"
            >
              Dashboard
            </NavLink>
          </nav>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_top,_#34d399,_#0f172a_72%)] text-xs font-semibold uppercase text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
              {user.avatar && showAvatarImage ? (
                <img
                  alt={user.name ?? user.email}
                  className="h-full w-full rounded-full object-cover"
                  onError={() => {
                    setShowAvatarImage(false);
                  }}
                  src={user.avatar}
                />
              ) : (
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M6.5 7.25h6.25a3.25 3.25 0 0 1 0 6.5H9.75v3.5H6.5v-10Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M14.75 9.25h2.75a2 2 0 0 1 0 4H15"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{user.name ?? "ReachInbox User"}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <Button
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              onClick={() => void logout()}
              size="sm"
              variant="ghost"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
