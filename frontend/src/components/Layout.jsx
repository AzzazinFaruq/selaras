import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import useAuthStore from "../stores/authStore";
import Ikon from "./Ikon";
import { inisial } from "../lib/format";
import latarSisi from "../assets/dashboard/latar-sisi.png";

const MENU = [
  { to: "/", label: "Dashboard", ikon: "dashboard", end: true },
  { to: "/audit-baru", label: "Audit baru", ikon: "audit" },
  { to: "/riwayat", label: "Riwayat", ikon: "riwayat" },
  { to: "/posyandu", label: "Posyandu", ikon: "posyandu" },
  { to: "/akun", label: "Akun", ikon: "akun" },
];
const MENU_ADMIN = { to: "/admin", label: "Administrasi", ikon: "admin" };

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [buka, setBuka] = useState(false); // laci menu di layar sempit

  useEffect(() => {
    if (!buka) return;
    const tutup = (e) => e.key === "Escape" && setBuka(false);
    window.addEventListener("keydown", tutup);
    return () => window.removeEventListener("keydown", tutup);
  }, [buka]);

  return (
    <div className="min-h-dvh xl:pl-64">
      {/* Layar sempit: bilah atas dengan tombol menu */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-navy px-2 text-white shadow-md xl:hidden">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
          aria-label="Buka menu" aria-expanded={buka} aria-controls="menu-sisi"
          onClick={() => setBuka(true)}
        >
          <Ikon nama="menu" className="size-6" />
        </button>
        <div className="logo-tulisan [--t:22]" role="img" aria-label="Selaras" />
      </header>

      {/* Ketuk di luar laci untuk menutupnya */}
      {buka && <div className="fixed inset-0 z-40 bg-tinta/60 xl:hidden" onClick={() => setBuka(false)} />}

      <aside
        id="menu-sisi"
        className={`sisi fixed inset-y-0 left-0 z-50 w-64 overflow-hidden text-white shadow-xl transition-[translate,visibility] duration-200 xl:visible xl:translate-x-0 ${
          buka ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <img src={latarSisi} alt="" className="sisi-latar" />

        <div className="relative flex h-full flex-col overflow-y-auto">
          <button
            type="button"
            className="absolute top-2 right-2 inline-flex size-10 items-center justify-center rounded hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white xl:hidden"
            aria-label="Tutup menu" onClick={() => setBuka(false)}
          >
            <Ikon nama="tutup" className="size-6" />
          </button>

          {/* Logo diletakkan di bawah lengkung atas gambar latar (≈ 17% tinggi sidebar). */}
          <div className="px-6 pt-[max(5rem,18cqh)]">
            <div className="logo-tulisan" role="img" aria-label="Selaras" />
            <p className="mt-3 font-label text-sm leading-snug text-muda">
              {`${user.puskesmas.nama} ● ${user.puskesmas.kota}`}
            </p>
          </div>

          <nav aria-label="Menu utama" className="panel-menu mx-4 mt-7 space-y-1 px-6 py-6">
            {(user.peran === "admin" ? [...MENU, MENU_ADMIN] : MENU).map((m) => (
              <NavLink
                key={m.to} to={m.to} end={m.end} onClick={() => setBuka(false)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded px-3 font-label text-base focus-visible:outline-2 focus-visible:outline-white ${
                    isActive ? "bg-aksen font-semibold text-tinta" : "text-white hover:bg-white/10"
                  }`
                }
              >
                <Ikon nama={m.ikon} />
                {m.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-6">
          <div className="space-y-3 border-t border-white/15 bg-tinta/85 px-4 pt-4 pb-5 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-1">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-aksen text-sm font-semibold text-tinta" aria-hidden="true">
                {inisial(user.nama)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.nama}</p>
                <p className="truncate text-xs text-muda">{user.email}</p>
              </div>
            </div>
            <button
              type="button" onClick={logout}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded border border-white/25 bg-white/5 px-4 text-sm font-medium hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Ikon nama="keluar" className="size-4" />
              Keluar
            </button>
          </div>
          </div>
        </div>
      </aside>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 xl:py-8">
        <Outlet />
      </main>
    </div>
  );
}
