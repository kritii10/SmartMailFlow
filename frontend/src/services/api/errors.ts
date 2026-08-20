import { AxiosError } from "axios";
import type { ApiErrorResponse } from "../../types";

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as ApiErrorResponse | undefined;
    return responseData?.error ?? error.message;
  }

  return error instanceof Error ? error.message : fallback;
};
