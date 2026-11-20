const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-10" -> "Okt 2026" */
export function labelPeriode(p) {
  if (!p) return "";
  const [y, m] = p.split("-");
  return `${BULAN[Number(m) - 1]} ${y}`;
}

/** 82.35 -> "82,35%"; null -> "–" */
export function labelPersen(v) {
  if (v === null || v === undefined) return "–";
  return `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

/** "2026-10-05" -> "05/10/2026" */
export function labelTanggal(s) {
  if (!s) return "–";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/** Waktu ISO dari server -> "05/10/26 14.30" (waktu lokal). */
export function labelWaktu(iso) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

/** Periode bulan ini, "YYYY-MM" (waktu lokal). */
export function periodeSekarang() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/** "Siti Nur Aini" -> "SN" */
export function inisial(nama) {
  return nama.trim().split(/\s+/).slice(0, 2).map((k) => k[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Daftar periode "YYYY-MM" mulai bulan ini mundur `jumlah` bulan (waktu lokal). */
export function daftarPeriode(jumlah = 36) {
  const t = new Date();
  return Array.from({ length: jumlah }, (_, i) => {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}
