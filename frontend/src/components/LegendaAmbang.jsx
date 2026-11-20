import { AMBANG } from "../lib/indikator";

/** Keterangan warna nilai persen di tabel (lihat kelasPersen). */
export default function LegendaAmbang({ className = "" }) {
  const butir = [
    { kelas: "bg-hijau", teks: `Hijau ≥ ${AMBANG.baik}%` },
    { kelas: "bg-biru", teks: `Biru ${AMBANG.cukup}% – < ${AMBANG.baik}%` },
    { kelas: "bg-merah", teks: `Merah < ${AMBANG.cukup}%` },
  ];
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy/75 ${className}`} aria-label="Arti warna persen">
      {butir.map((b) => (
        <li key={b.teks} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${b.kelas}`} aria-hidden="true" />
          {b.teks}
        </li>
      ))}
    </ul>
  );
}
