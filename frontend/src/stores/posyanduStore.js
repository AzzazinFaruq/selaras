import { create } from "zustand";
import api, { pesanGalat } from "../api/axios";

const usePosyanduStore = create((set) => ({
  posyandu: [],
  loading: false,
  error: null,

  fetchPosyandu: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get("/posyandu");
      set({ posyandu: res.data.data, loading: false });
    } catch (err) {
      set({ loading: false, error: pesanGalat(err, "Gagal memuat posyandu") });
    }
  },

  createPosyandu: async (data) => {
    try {
      await api.post("/posyandu", data);
      const res = await api.get("/posyandu");
      set({ posyandu: res.data.data, error: null });
      return true;
    } catch (err) {
      set({ error: pesanGalat(err, "Gagal menambah posyandu") });
      return false;
    }
  },

  updatePosyandu: async (id, data) => {
    try {
      await api.put(`/posyandu/${id}`, data);
      const res = await api.get("/posyandu");
      set({ posyandu: res.data.data, error: null });
      return true;
    } catch (err) {
      set({ error: pesanGalat(err, "Gagal mengubah posyandu") });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

export default usePosyanduStore;
