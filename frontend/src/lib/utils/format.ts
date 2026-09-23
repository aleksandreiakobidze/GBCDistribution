import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ka } from 'date-fns/locale';

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return '—';
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return '—';
  }
  return `₾${num.toFixed(2)}`;
}

export function formatDate(dateStr: string, fmt: string = 'MMM dd, yyyy'): string {
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  return formatDate(dateStr, 'MMM dd, yyyy HH:mm');
}

export function formatVisitClock(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return '';
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('ka-GE', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Tbilisi',
  }).format(date);
}

export function formatRelative(dateStr: string, locale?: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), {
      addSuffix: true,
      locale: locale === 'ka' ? ka : undefined,
    });
  } catch {
    return dateStr;
  }
}

export function formatPhone(phone: string): string {
  return phone;
}
