/**
 * Allowed credentials for app login (plain comparison, no hash).
 * For dev / low-security use only; do not use for sensitive deployments.
 */
export const CREDENTIALS = {
  username: "alonzo",
  password: "alonzo",
} as const;

export function checkCredentials(username: string, password: string): boolean {
  return (
    username.trim() === CREDENTIALS.username &&
    password === CREDENTIALS.password
  );
}
