import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Enhanced error interface matching backend JSON format
interface APIErrorResponse {
  error: {
    code: number;
    type: string;
    message: string;
    path?: string;
    method?: string;
    request_id?: string;
  };
}

// Create enhanced error class with request ID support
export class APIError extends Error {
  public readonly code: number;
  public readonly type: string;
  public readonly requestId?: string;
  public readonly path?: string;
  public readonly method?: string;

  constructor(
    message: string,
    code: number,
    type: string = 'UnknownError',
    requestId?: string,
    path?: string,
    method?: string
  ) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.type = type;
    this.requestId = requestId;
    this.path = path;
    this.method = method;
  }

  // Create user-friendly error message with optional request ID
  getUserMessage(showRequestId = false): string {
    let message = this.message;
    
    // Add request ID for debugging if requested
    if (showRequestId && this.requestId) {
      message += ` (Request ID: ${this.requestId})`;
    }
    
    return message;
  }

  // Get user-friendly title based on error type
  getUserTitle(): string {
    switch (this.type) {
      case 'ValidationError':
        return 'Invalid Input';
      case 'NotFound':
        return 'Not Found';
      case 'Unauthorized':
        return 'Access Denied';
      case 'Forbidden':
        return 'Permission Required';
      case 'RateLimitExceeded':
        return 'Too Many Requests';
      case 'InternalServerError':
        return 'System Error';
      default:
        return 'Error';
    }
  }
}

// Enhanced error parser that handles both JSON and text responses
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData: APIErrorResponse | null = null;
    
    try {
      // Try to parse as JSON first (our backend format)
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await res.json() as APIErrorResponse;
      }
    } catch (e) {
      // If JSON parsing fails, fall back to text
    }
    
    if (errorData?.error) {
      // Use parsed backend error format
      const { code, type, message, request_id, path, method } = errorData.error;
      throw new APIError(message, code, type, request_id, path, method);
    } else {
      // Fallback to text/statusText for non-JSON responses
      const text = (await res.text().catch(() => '')) || res.statusText;
      const userFriendlyMessage = getUserFriendlyMessage(res.status, text);
      throw new APIError(userFriendlyMessage, res.status, getErrorType(res.status));
    }
  }
}

// Map HTTP status codes to user-friendly messages
function getUserFriendlyMessage(status: number, originalMessage: string): string {
  switch (status) {
    case 400:
      return 'Please check your input and try again';
    case 401:
      return 'Please log in to access this feature';
    case 403:
      return 'You don\'t have permission to access this';
    case 404:
      return 'The requested information could not be found';
    case 429:
      return 'Too many requests. Please wait a moment and try again';
    case 500:
      return 'Something went wrong on our end. Please try again';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later';
    default:
      return originalMessage || 'An unexpected error occurred';
  }
}

// Map HTTP status codes to error types
function getErrorType(status: number): string {
  switch (status) {
    case 400:
      return 'ValidationError';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'NotFound';
    case 429:
      return 'RateLimitExceeded';
    case 500:
      return 'InternalServerError';
    default:
      return 'UnknownError';
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
