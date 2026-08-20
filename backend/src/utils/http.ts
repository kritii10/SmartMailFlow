import { Response } from "express";

export const sendError = (response: Response, status: number, message: string) => {
  response.status(status).json({
    error: message
  });
};

export const sendData = <T>(response: Response, data: T, status = 200) => {
  response.status(status).json({
    data
  });
};

export const sendPaginated = <T>(
  response: Response,
  params: {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
  }
) => {
  const totalPages = params.total === 0 ? 0 : Math.ceil(params.total / params.pageSize);

  response.json({
    data: params.data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total: params.total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1
    }
  });
};
