const KEY = "presenter-token";

export function getPresenterToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setPresenterToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export function clearPresenterToken(): void {
  localStorage.removeItem(KEY);
}
