import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";

export const AppLayout = () => (
  <main className="page-shell">
    <div className="page-container grid gap-6">
      <AppHeader />
      <Outlet />
    </div>
  </main>
);
