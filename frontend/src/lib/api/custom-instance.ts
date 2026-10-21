// Custom fetcher for Orval generated TanStack Query hooks

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface CustomInstanceConfig {
  url: string;
  method?: string;
  params?: Record<string, any>;
  data?: any;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export interface CustomResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export const customInstance = async <T>(
  configOrUrl: string | CustomInstanceConfig,
  options?: RequestInit,
): Promise<CustomResponse<T>> => {
  let url = typeof configOrUrl === "string" ? configOrUrl : configOrUrl.url;
  const method =
    typeof configOrUrl === "string"
      ? options?.method || "GET"
      : configOrUrl.method || "GET";
  const initialHeaders =
    typeof configOrUrl === "string" ? options?.headers : configOrUrl.headers;
  const signal =
    typeof configOrUrl === "string" ? options?.signal : configOrUrl.signal;

  let body: BodyInit | undefined;
  if (typeof configOrUrl === "string") {
    body = options?.body || undefined;
  } else if (configOrUrl.data !== undefined) {
    if (
      configOrUrl.data instanceof FormData ||
      typeof configOrUrl.data === "string"
    ) {
      body = configOrUrl.data;
    } else {
      body = JSON.stringify(configOrUrl.data);
    }
  }

  if (typeof configOrUrl !== "string" && configOrUrl.params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(configOrUrl.params)) {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    }
    const queryStr = searchParams.toString();
    if (queryStr) {
      url += (url.includes("?") ? "&" : "?") + queryStr;
    }
  }

  const fullUrl = `${BASE_URL}${url}`;
  const headers = new Headers(initialHeaders);

  // In browser, retrieve token if present
  if (typeof window !== "undefined") {
    let token = localStorage.getItem("auth_token");
    if (!token) {
      const match =
        document.cookie.match(/auth_token=([^;]+)/) ||
        document.cookie.match(/better-auth\.session_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]).split(".")[0].replace(/^s:/, "");
      }
    }
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (!headers.has("Content-Type") && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(fullUrl, {
    method,
    headers,
    body,
    signal,
    credentials: "include", // Send cookies along with requests
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    throw errorData;
  }

  let data: any = null;
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  };
};

export default customInstance;
