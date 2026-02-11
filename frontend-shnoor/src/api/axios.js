import axios from "axios";
import { auth } from "../auth/firebase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;

    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      "Your account is suspended. Please contact admin.";

    if (status === 403) {
      try {
        await auth.signOut();
      } catch (e) {
        console.error("Logout error:", e);
      }

      if (window.location.pathname !== "/login") {
        alert(message);
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
