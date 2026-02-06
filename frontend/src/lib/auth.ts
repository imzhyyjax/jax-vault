export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jax_token");
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("jax_token", token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("jax_token");
}

