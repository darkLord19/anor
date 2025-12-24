/**
 * Utility functions for UI components
 */

export function showMessage(
  element: HTMLElement,
  text: string,
  isError = false,
  isSuccess = false
): void {
  element.textContent = text;
  element.className = `message ${isError ? 'error' : isSuccess ? 'success' : ''} show`;
  element.style.display = 'block';
}

export function hideMessage(element: HTMLElement): void {
  element.className = 'message';
  element.style.display = 'none';
}

export function setLoading(button: HTMLButtonElement, loading: boolean): void {
  button.disabled = loading;
  if (loading) {
    button.innerHTML = '<span class="spinner"></span>';
  }
}

export function formatEmail(email: string | null | undefined): string {
  return email ?? 'Unknown user';
}

