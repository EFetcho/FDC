export class UserFacingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UserFacingError";
    this.status = status;
  }
}

export function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof UserFacingError) return error.message;
  console.error(fallback, error instanceof Error ? error.message : error);
  return fallback;
}
