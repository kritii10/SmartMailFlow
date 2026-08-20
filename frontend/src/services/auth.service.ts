import type { ApiResponse, AuthUser } from "../types";
import { getApiErrorMessage } from "./api/errors";
import { buildApiUrl, apiClient } from "./api/client";

export const authService = {
  getGoogleLoginUrl() {
    return buildApiUrl("/auth/google");
  },

  async getCurrentUser() {
    const response = await apiClient.get<ApiResponse<AuthUser>>("/auth/me");
    return response.data.data;
  },

  async logout() {
    await apiClient.post("/auth/logout");
  },

  getErrorMessage: getApiErrorMessage
};
