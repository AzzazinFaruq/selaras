import { create } from "zustand";
import api, { pesanGalat } from "../api/axios";

const useAuthStore = create((set) => ({
  user: null,
  sudahCek: false, // false = belum tahu apakah ada sesi (tampilkan "memuat")
  loading: false,
  error: null,

  fetchUser: async () => {
    try {
      const res = await api.get("/saya");
      set({ user: res.data.user, sudahCek: true });
    } catch {
      set({ user: null, sudahCek: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post("/login", { email, password });
      set({ user: res.data.user, loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: pesanGalat(err, "Login gagal") });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.post("/logout", {});
    } catch {
      // sesi mungkin sudah berakhir; tetap keluar di sisi klien
    }
    set({ user: null });
  },

  gantiPassword: async (password_lama, password_baru) => {
    await api.put("/password", { password_lama, password_baru });
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));

// Dipicu interceptor axios saat API membalas 401.
window.addEventListener("sesi-berakhir", () => useAuthStore.setState({ user: null }));

export default useAuthStore;
