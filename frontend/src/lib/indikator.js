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
    tanya: "Apakah semua balita di buku register sudah masuk ASIK?",
    rumus: "balita sampel yang ditemukan di ASIK ÷ seluruh balita sampel",
    turun: "Turun bila ada balita yang ditimbang tetapi belum diinput (kolom “Tidak di ASIK”).",
  },
  {
    kunci: "persen_kesesuaian",
    label: "Kesesuaian",
    warna: "#e2622d",
    tanya: "Apakah isi di ASIK sama persis dengan buku register?",
    rumus: "balita yang tanggal ukur, BB, dan PB/TB-nya sama ÷ balita yang ada di ASIK",
    turun: "Turun bila ada salah ketik tanggal ukur, BB, atau PB/TB. Satu balita bisa punya lebih dari satu selisih, tetapi tetap dihitung satu.",
  },
  {
    kunci: "persen_ketepatan",
    label: "Ketepatan waktu",
    warna: "#199e70",
    tanya: `Apakah data diinput paling lambat ${BATAS_HARI_INPUT} hari setelah hari posyandu?`,
    rumus: `balita yang diinput ≤ ${BATAS_HARI_INPUT} hari ÷ balita yang ada di ASIK`,
    turun: "Turun bila input ke ASIK terlambat (kolom “Terlambat”).",
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
