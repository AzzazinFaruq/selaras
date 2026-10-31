import axios from "axios";

// Frontend dan API satu origin (dev: proxy Vite, produksi: disajikan backend Go).
// Token ada di cookie HttpOnly yang dikirim otomatis oleh browser; frontend
// tidak pernah memegang token, jadi tidak ada localStorage di sini.
const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? "";
    if (error.response?.status === 401 && url !== "/login") {
      window.dispatchEvent(new Event("sesi-berakhir"));
    }
    return Promise.reject(error);
  }
);

export const pesanGalat = (err, cadangan) => err.response?.data?.error || cadangan;

export default api;
