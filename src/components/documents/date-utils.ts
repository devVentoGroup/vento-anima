export function addMonthsSafe(date: Date, months: number) {
  const base = new Date(date);
  const day = base.getDate();
  base.setMonth(base.getMonth() + months);
  if (base.getDate() < day) {
    base.setDate(0);
  }
  return base;
}

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatShortDate(value: string | null) {
  if (!value) return "Sin vencimiento";
  return parseDateOnly(value).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function diffDays(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.ceil(ms / 86400000);
}
