import axios from "axios";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "./constants";

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, ""); // ensure no trailing slash

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // must be here globally, not per request
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// --------------------- REQUEST INTERCEPTOR ---------------------
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Include CORS-related headers for safety
    config.headers["Access-Control-Allow-Origin"] =
      "https://dev-rir2e2r4t-srishtis-projects-3408febe.vercel.app";
    config.headers["Access-Control-Allow-Credentials"] = "true";
    config.headers["Access-Control-Allow-Headers"] =
      "Authorization, Content-Type, Accept";

    return config;
  },
  (error) => Promise.reject(error)
);

// --------------------- RESPONSE INTERCEPTOR ---------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN);
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/api/token/refresh/`,
            { refresh: refreshToken },
            {
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              withCredentials: true,
            }
          );

          if (response.data.access) {
            localStorage.setItem(ACCESS_TOKEN, response.data.access);

            originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        localStorage.removeItem(ACCESS_TOKEN);
        localStorage.removeItem(REFRESH_TOKEN);
        console.error("Authentication failed. Please log in again.");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
