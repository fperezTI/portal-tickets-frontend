import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Formatea horas siempre con un decimal (3 -> "3.0", 3.5 -> "3.5").
export function fmtHours(h) {
  return Number(h ?? 0).toFixed(1);
}
