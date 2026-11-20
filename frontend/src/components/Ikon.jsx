// Ikon garis sederhana (inline SVG) supaya tidak perlu pustaka ikon dan tetap
// lolos CSP `script-src 'self'`.
const PATH = {
  menu: "M4 6h16M4 12h16M4 18h16",
  tutup: "M6 6l12 12M18 6L6 18",
  dashboard: "M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6",
  audit: "M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 005 7v12a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19V7a1.5 1.5 0 00-1.5-1.5H15M9 14l2 2 4-4.5",
  riwayat: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  posyandu: "M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
  admin: "M12 3.5l7 2.5v5.5c0 4-2.8 7.4-7 9-4.2-1.6-7-5-7-9V6l7-2.5zM9 12l2.2 2.2L15 10.5",
  akun: "M16 8a4 4 0 11-8 0 4 4 0 018 0zM4.5 20a7.5 7.5 0 0115 0",
  keluar: "M15 16l4-4-4-4M19 12H9M12 4H6.5A1.5 1.5 0 005 5.5v13A1.5 1.5 0 006.5 20H12",
  cari: "M20 20l-4.5-4.5M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z",
  mata: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
  mataTutup: "M4 4l16 16M10 5.7a9.4 9.4 0 012-.2c6 0 9.5 6.5 9.5 6.5a17 17 0 01-2.7 3.5M6.5 7.5A16.5 16.5 0 002.5 12S6 18.5 12 18.5a9 9 0 004-1M9.9 9.9a3 3 0 004.2 4.2",
  cek: "M5 12.5l4.5 4.5L19 7.5",
  info: "M12 11v5M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  kiri: "M15 6l-6 6 6 6",
  kanan: "M9 6l6 6-6 6",
  bawah: "M6 9l6 6 6-6",
  gedung: "M4 20h16M6 20V6l6-2.5 6 2.5V20M10 10h.01M14 10h.01M10 14h.01M14 14h.01",
  surat: "M4 6h16v12H4zM4 7l8 6 8-6",
  lokasi: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  gembok: "M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z",
};

export default function Ikon({ nama, className = "size-5" }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATH[nama]} />
    </svg>
  );
}
