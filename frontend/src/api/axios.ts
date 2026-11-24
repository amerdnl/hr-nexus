import axios from "axios";

export const AUTH_TOKEN_KEY = "hr_nexus_token";
export const UNAUTHORIZED_EVENT = "hr-nexus:unauthorized";

/**
 * Where the API lives when `VITE_API_BASE_URL` is not set: the local Compose
 * stack's backend. Docker Compose and the hosted build both set the variable,
 * so this is only reached by a developer running `npm run dev` by hand, and its
 * use is announced below so a wrong backend is one glance at the console away.
 */
const FALLBACK_API_BASE_URL = "http://localhost:5003/api";

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? FALLBACK_API_BASE_URL;

if (import.meta.env.DEV && import.meta.env.VITE_API_BASE_URL === undefined) {
  // Not an error: this is the documented default for local development. It is
  // said out loud so that "which backend am I actually talking to?" is one
  // glance at the console rather than an afternoon in the network tab.
  console.warn(
    `[HR Nexus] VITE_API_BASE_URL is not set, so the API is assumed to be ${FALLBACK_API_BASE_URL}. ` +
      `If you meant to reach a different environment, set VITE_API_BASE_URL - and check that no other ` +
      `dev server has taken this page's port.`,
  );
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
}

export function resolveProfileImageUrl(imagePath: string | null): string | null {
  if (!imagePath?.startsWith("/uploads/profile-images/")) return null;

  const apiBaseUrl = new URL(API_BASE_URL, window.location.origin);

  return new URL(imagePath, apiBaseUrl.origin).toString();
}

export default apiClient;
