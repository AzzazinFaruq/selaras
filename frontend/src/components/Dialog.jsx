import { useEffect, useId, useRef } from "react";
import Ikon from "./Ikon";

/**
 * Pop-up modal di atas halaman, memakai <dialog> bawaan browser (fokus
 * terkurung di dalamnya, Esc menutup). `terkunci` mencegah ditutup selagi
 * proses berjalan, mis. saat menyimpan. Fokus awal jatuh ke elemen
 * ber-atribut `data-fokus` bila ada (tombol aman/utama), bukan tombol tutup.
 */
export default function Dialog({ buka, onTutup, judul, terkunci = false, children }) {
  const ref = useRef(null);
  const idJudul = useId();

  useEffect(() => {
    const d = ref.current;
    if (buka && !d.open) {
      d.showModal();
      d.querySelector("[data-fokus]")?.focus();
    }
    if (!buka && d.open) d.close();
  }, [buka]);

  return (
    <dialog
      ref={ref} aria-labelledby={idJudul}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none items-center justify-center bg-tinta/60 p-4 text-navy backdrop:bg-transparent open:flex"
      onClose={onTutup}
      onCancel={(e) => terkunci && e.preventDefault()}
      onClick={(e) => e.target === ref.current && !terkunci && onTutup()}
    >
      {buka && (
        <div className="kartu max-h-full w-full max-w-lg overflow-y-auto p-0 shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-navy/10 py-3 pr-2 pl-5">
            <h2 id={idJudul} className="subjudul py-1.5">{judul}</h2>
            <button
              type="button" aria-label="Tutup" disabled={terkunci} onClick={onTutup}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded text-navy/75 hover:bg-navy/5 hover:text-navy focus-visible:outline-2 focus-visible:outline-navy disabled:opacity-40"
            >
              <Ikon nama="tutup" />
            </button>
          </div>
          <div className="space-y-4 p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
