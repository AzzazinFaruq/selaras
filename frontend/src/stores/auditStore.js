import { create } from "zustand";
import api, { pesanGalat } from "../api/axios";

// Store ini hanya memegang angka agregat dari server. Data balita dari file
// TIDAK disimpan di store; ia hanya hidup di state halaman Audit Baru.
const useAuditStore = create((set) => ({
  tren: [],
  riwayat: [],
  // true setelah percobaan muat pertama selesai, supaya halaman tidak sempat
  // menampilkan "belum ada audit" sebelum datanya datang.
  trenSiap: false,
  riwayatSiap: false,
  loading: false,
  error: null,

  fetchTren: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get("/tren");
      set({ tren: res.data.data, loading: false, trenSiap: true });
    } catch (err) {
      set({ loading: false, trenSiap: true, error: pesanGalat(err, "Gagal memuat tren") });
    }
  },

  fetchRiwayat: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get("/audit");
      set({ riwayat: res.data.data, loading: false, riwayatSiap: true });
    } catch (err) {
      set({ loading: false, riwayatSiap: true, error: pesanGalat(err, "Gagal memuat riwayat") });
    }
  },

  // Melempar error supaya halaman bisa menampilkan pesannya.
  createAudit: async (payload) => {
    await api.post("/audit", payload);
  },

  deleteAudit: async (id) => {
    try {
      await api.delete(`/audit/${id}`);
      set((state) => ({ riwayat: state.riwayat.filter((a) => a.id !== id), error: null }));
      return true;
    } catch (err) {
      set({ error: pesanGalat(err, "Gagal menghapus audit") });
      return false;
    }
  },
}));

export default useAuditStore;
