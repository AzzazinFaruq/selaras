import { NavLink, Outlet } from "react-router-dom";
import useAuthStore from "../stores/authStore";

const MENU = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/audit-baru", label: "Audit baru" },
  { to: "/riwayat", label: "Riwayat" },
  { to: "/posyandu", label: "Posyandu" },
  { to: "/akun", label: "Akun" },
];

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="mr-auto">
            <p className="font-semibold text-teal-800">SELARAS</p>
            <p className="text-xs text-slate-500">
              {user.puskesmas.nama} · {user.puskesmas.kota}
            </p>
          </div>
          <nav className="flex flex-wrap gap-1 text-sm">
            {MENU.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 ${isActive ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-100"}`
                }
              >
                {m.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">{user.nama}</span>
            <button onClick={logout} className="tombol-garis py-1.5">Keluar</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
