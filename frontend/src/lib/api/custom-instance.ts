// Custom fetcher for Orval generated TanStack Query hooks

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const customInstance = async <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const fullUrl = `${BASE_URL}${url}`;
  const headers = new Headers(options?.headers);

  // In browser, retrieve token if present
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (!headers.has("Content-Type") && !(options?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
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
  } as T;
};

export default customInstance;
