// Configuration helpers for validating source panorama URLs and
// restricting external network requests on the backend.

// Define a comma-separated list of allowed host names in your
// environment variable ALLOWLIST_HOSTS. This prevents the API
// from fetching arbitrary URLs. If none is provided it defaults to
// localhost.

export const ALLOWLISTED_IMAGE_HOSTS: string[] = (process.env.ALLOWLIST_HOSTS || 'localhost').split(
  ','
);

export function isAllowedSource(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWLISTED_IMAGE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}