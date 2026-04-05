import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "https://jan-sahayak-ai-84vh.onrender.com";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT to every request
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken") || 
                localStorage.getItem("token") || 
                localStorage.getItem("jwt") || 
                localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login?error=expired";
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;