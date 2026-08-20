import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getInitials } from "../../utils/format";
import { Button } from "../ui/Button";

export const AppHeader = () => {
  const { logout, user } = useAuth();

  if (!user) {
    return null;
  }

  const initials = getInitials(user.name, user.email);

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
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold uppercase text-slate-700">
              {user.avatar ? (
                <img
                  alt={user.name ?? user.email}
                  className="h-full w-full rounded-full object-cover"
                  src={user.avatar}
                />
              ) : (
                initials
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
