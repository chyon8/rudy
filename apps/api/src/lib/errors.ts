export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Not found') => new AppError('not_found', 404, message);
export const unauthorized = (message = 'Unauthorized') =>
  new AppError('unauthorized', 401, message);
export const serviceUnavailable = (message: string) =>
  new AppError('service_unavailable', 503, message);
