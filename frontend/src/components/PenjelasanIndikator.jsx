import Ikon from "./Ikon";
import { INDIKATOR } from "../lib/indikator";

/** Kartu lipat berisi arti tiga indikator. `buka` untuk menampilkannya terbuka. */
export default function PenjelasanIndikator({ buka = false }) {
  return (
    <details className="kartu group p-0" open={buka}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded px-4 py-3 text-sm font-semibold hover:bg-navy/5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <Ikon nama="info" className="size-5" />
        Cara membaca tiga indikator
        <Ikon nama="bawah" className="ml-auto size-4 text-navy/75 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t border-navy/10 px-4 py-4 sm:px-5 md:grid-cols-3">
        {INDIKATOR.map((s) => (
          <div key={s.kunci} className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <span className="inline-block size-2.5 rounded-full" style={{ background: s.warna }} />
              {s.label}
            </p>
            <p>{s.tanya}</p>
            <p className="text-xs text-navy/75">= {s.rumus}</p>
            <p className="text-xs text-navy/75">{s.turun}</p>
          </div>
        ))}
        <p className="text-xs text-navy/75 md:col-span-3">
          Ketiganya dalam persen; makin dekat 100% makin baik. Kesesuaian dan ketepatan waktu hanya dihitung dari balita
          yang ada di ASIK, jadi keduanya bisa tinggi walau kelengkapan rendah.
        </p>
      </div>
    </details>
  );
}
