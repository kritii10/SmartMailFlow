export type ApiResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  error: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: PaginationMeta;
};

export type PaginationQuery = {
  page?: number;
  pageSize?: number;
};
