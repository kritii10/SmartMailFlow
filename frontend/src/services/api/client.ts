import axios from "axios";

const resolveApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000/api`;
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
