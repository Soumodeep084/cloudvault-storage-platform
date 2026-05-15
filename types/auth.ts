export type ActionResponse<T = unknown> = {
    success: boolean;
    message: string;
    status: number;
    data?: T;
    errors?: Record<string, string[]>; // For Zod validation arrays
};