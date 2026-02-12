import { clearAccessToken } from "@/auth-state";
import { ROUTES } from "@/router/routes";

const PUBLIC_ROUTES = [
  ROUTES.AUTH, // Authentication pages
  ROUTES.EXPLORE, // Explore page
  "/u/", // User profile pages (dynamic)
  "/memos/", // Individual memo detail pages (dynamic)
] as const;

const PRIVATE_ROUTES = [ROUTES.ROOT, ROUTES.ATTACHMENTS, ROUTES.INBOX, ROUTES.ARCHIVED, ROUTES.SETTING] as const;

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

export function isPrivateRoute(path: string): boolean {
  return PRIVATE_ROUTES.includes(path as (typeof PRIVATE_ROUTES)[number]);
}

// Guard against multiple simultaneous redirects which cause Chrome's
// "Throttling navigation to prevent the browser from hanging" error.
let isRedirecting = false;

/**
 * Redirect to the auth page on authentication failure.
 * Uses a guard to prevent multiple concurrent redirects.
 * Prefer using React Router's navigate() from components instead.
 * This function is a last-resort fallback for non-React code paths.
 */
export function redirectOnAuthFailure(): void {
  if (isRedirecting) {
    return;
  }

  const currentPath = window.location.pathname;

  // Don't redirect if already on a public route
  if (isPublicRoute(currentPath)) {
    return;
  }

  if (isPrivateRoute(currentPath)) {
    isRedirecting = true;
    clearAccessToken();
    window.location.replace(ROUTES.AUTH);
    // Reset after a short delay in case the navigation doesn't complete
    // (e.g., blocked by beforeunload handler)
    setTimeout(() => {
      isRedirecting = false;
    }, 1000);
  }
}
