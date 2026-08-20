import axios from "axios";

const normalizeApiBaseUrl = (value: string) => {
  const trimmedValue = value.replace(/\/$/, "");
  return trimmedValue.endsWith("/api") ? trimmedValue : `${trimmedValue}/api`;
};

const resolveApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `${window.location.protocol}//${window.location.hostname}:4000/api`;
    }

    return `${window.location.origin}/api`;
  }

  return "http://localhost:4000/api";
};

const API_BASE_URL = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

export const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

export const getApiBaseUrl = () => API_BASE_URL;
