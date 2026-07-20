export type ConfirmSpec = {
  title: string;
  body?: string;
  consequences?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmRequest = { spec: ConfirmSpec; resolve: (ok: boolean) => void };

let confirmRequest = $state<ConfirmRequest | null>(null);

export function confirmModal(spec: ConfirmSpec): Promise<boolean> {
  return new Promise((resolve) => {
    confirmRequest?.resolve(false);
    confirmRequest = { spec, resolve };
  });
}

export function getConfirmRequest(): ConfirmRequest | null {
  return confirmRequest;
}

export function settleConfirm(ok: boolean): void {
  confirmRequest?.resolve(ok);
  confirmRequest = null;
}

export type ToastTone = 'info' | 'success' | 'danger';
export type Toast = { id: number; message: string; tone: ToastTone };

let toasts = $state<Toast[]>([]);
let nextToastId = 1;

export function toast(message: string, tone: ToastTone = 'info'): void {
  const id = nextToastId++;
  toasts.push({ id, message, tone });
  setTimeout(() => dismissToast(id), 5000);
}

export function getToasts(): Toast[] {
  return toasts;
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
}

let paletteOpen = $state(false);

export function isPaletteOpen(): boolean {
  return paletteOpen;
}

export function setPaletteOpen(v: boolean): void {
  paletteOpen = v;
}

export function togglePalette(): void {
  paletteOpen = !paletteOpen;
}
