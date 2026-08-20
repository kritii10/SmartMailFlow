import type {
  ApiResponse,
  EmailRecord,
  PaginatedResponse,
  PaginationQuery,
  ScheduleEmailsRequest,
  ScheduleEmailsResponse
} from "../types";
import { apiClient } from "./api/client";

const withPagination = (query?: PaginationQuery) => ({
  page: query?.page ?? 1,
  pageSize: query?.pageSize ?? 5
});

export const emailService = {
  async listScheduledEmails(query?: PaginationQuery) {
    const response = await apiClient.get<PaginatedResponse<EmailRecord>>("/emails/scheduled", {
      params: withPagination(query)
    });

    return response.data;
  },

  async listSentEmails(query?: PaginationQuery) {
    const response = await apiClient.get<PaginatedResponse<EmailRecord>>("/emails/sent", {
      params: withPagination(query)
    });

    return response.data;
  },

  async getEmail(emailId: string) {
    const response = await apiClient.get<ApiResponse<EmailRecord>>(`/emails/${emailId}`);
    return response.data.data;
  },

  async scheduleEmails(payload: ScheduleEmailsRequest) {
    const response = await apiClient.post<ApiResponse<ScheduleEmailsResponse>>(
      "/emails/schedule",
      payload
    );

    return response.data.data;
  }
};
