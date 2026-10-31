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

/** Periode bulan ini, "YYYY-MM" (waktu lokal). */
export function periodeSekarang() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}
