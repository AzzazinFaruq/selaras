import Ikon from "./Ikon";

// 1 … 4 5 6 … 12 (halaman pertama, terakhir, dan tetangga halaman aktif)
function daftarNomor(aktif, jumlah) {
  if (jumlah <= 7) return Array.from({ length: jumlah }, (_, i) => i + 1);
  const inti = [aktif - 1, aktif, aktif + 1].filter((n) => n > 1 && n < jumlah);
  const hasil = [1];
  if (inti[0] > 2) hasil.push("…awal");
  hasil.push(...inti);
  if (inti.at(-1) < jumlah - 1) hasil.push("…akhir");
  hasil.push(jumlah);
  return hasil;
}

/** `p` adalah hasil usePaginasi(). */
export default function Paginasi({ p, satuan = "data" }) {
  if (p.total === 0) return null;
  const akhir = p.awal + p.potong.length;
  const tombol = "inline-flex size-9 items-center justify-center rounded text-sm tabular-nums";

  return (
    <nav aria-label="Halaman" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm text-navy/75 sm:px-5">
      <p>
        <span className="font-semibold text-navy tabular-nums">{p.awal + 1}–{akhir}</span> dari{" "}
        <span className="font-semibold text-navy tabular-nums">{p.total}</span> {satuan}
      </p>

      {p.jumlahHalaman > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button" aria-label="Halaman sebelumnya"
            className={`${tombol} border border-navy/30 bg-white text-navy hover:bg-navy/5 disabled:opacity-40`}
            disabled={p.halaman === 1} onClick={() => p.setHalaman(p.halaman - 1)}
          >
            <Ikon nama="kiri" className="size-4" />
          </button>

          <span className="px-2 tabular-nums sm:hidden">{p.halaman} / {p.jumlahHalaman}</span>
          <div className="hidden items-center gap-1 sm:flex">
            {daftarNomor(p.halaman, p.jumlahHalaman).map((n) =>
              typeof n === "string" ? (
                <span key={n} className="px-1 text-navy/55">…</span>
              ) : (
                <button
                  key={n} type="button" onClick={() => p.setHalaman(n)}
                  aria-current={n === p.halaman ? "page" : undefined}
                  className={`${tombol} ${n === p.halaman ? "bg-navy font-semibold text-white" : "text-navy hover:bg-navy/10"}`}
                >
                  {n}
                </button>
              )
            )}
          </div>

          <button
            type="button" aria-label="Halaman berikutnya"
            className={`${tombol} border border-navy/30 bg-white text-navy hover:bg-navy/5 disabled:opacity-40`}
            disabled={p.halaman === p.jumlahHalaman} onClick={() => p.setHalaman(p.halaman + 1)}
          >
            <Ikon nama="kanan" className="size-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
