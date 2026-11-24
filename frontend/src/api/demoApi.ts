import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";

export interface DemoAccount {
  email: string;
  password: string;
  resetsDaily: boolean;
}

/**
 * The published demo sign-in, or null when this deployment is not the public
 * demo (the API answers 404 unless DEMO_MODE is on). Never throws: the login
 * page works the same either way.
 */
export async function demoAccountRequest(): Promise<DemoAccount | null> {
  try {
    const response = await apiClient.get<ApiResponse<DemoAccount>>("/demo");
    return response.data.data ?? null;
  } catch {
    return null;
  }
}
