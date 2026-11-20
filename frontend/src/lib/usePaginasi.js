import { useState } from "react";

/**
 * Memotong daftar per halaman. Halaman aktif dijepit ke rentang yang ada,
 * jadi daftar yang menyusut (filter, hapus) tidak meninggalkan halaman kosong.
 */
export default function usePaginasi(items, perHalaman = 10) {
  const [halaman, setHalaman] = useState(1);
  const jumlahHalaman = Math.max(1, Math.ceil(items.length / perHalaman));
  const aktif = Math.min(halaman, jumlahHalaman);
  const awal = (aktif - 1) * perHalaman;
  return {
    halaman: aktif,
    jumlahHalaman,
    setHalaman,
    awal,
    total: items.length,
    potong: items.slice(awal, awal + perHalaman),
  };
}
