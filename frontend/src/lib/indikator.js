import { BATAS_HARI_INPUT } from "./rekonsiliasi";

// Satu sumber untuk nama, warna, dan arti indikator, dipakai Dashboard,
// Riwayat, dan Audit baru supaya penjelasannya tidak berbeda antarhalaman.
//
// Warna seri tetap per indikator (tidak berubah walau filter berubah).
// Kontras ketiganya ≥ 3:1 di atas kartu putih; grafik tetap disertai legenda
// + tabel.
export const INDIKATOR = [
  {
    kunci: "persen_kelengkapan",
    label: "Kelengkapan",
    warna: "#3987e5",
  },
  {
    kunci: "persen_kesesuaian",
    label: "Kesesuaian",
    warna: "#e2622d",
  },
  {
    kunci: "persen_ketepatan",
    label: "Ketepatan waktu",
    warna: "#199e70",
  },
];

// Jumlah balita per jenis temuan, urut sesuai indikator yang dipengaruhinya.
export const TEMUAN = [
  { kunci: "jml_tidak_ada_di_asik", label: "Tidak ada di ASIK", pendek: "Tidak di ASIK" },
  { kunci: "jml_selisih_tanggal", label: "Tanggal ukur berbeda", pendek: "Tgl ukur beda" },
  { kunci: "jml_selisih_bb", label: "BB berbeda", pendek: "BB beda" },
  { kunci: "jml_selisih_tb", label: "PB/TB berbeda", pendek: "PB/TB beda" },
  { kunci: "jml_terlambat", label: `Input terlambat (> ${BATAS_HARI_INPUT} hari)`, pendek: "Terlambat" },
];

// Ambang warna persen di tabel, mengikuti keterangan di desain:
// "Hijau ≥95% · Biru 85–94% · Merah <85%".
export const AMBANG = { baik: 95, cukup: 85 };

/** Kelas warna untuk nilai persen; null (belum ada nilai) tidak diwarnai. */
export function kelasPersen(v) {
  if (v === null || v === undefined) return "text-navy/55";
  if (v >= AMBANG.baik) return "text-hijau";
  if (v >= AMBANG.cukup) return "text-biru";
  return "text-merah";
}
