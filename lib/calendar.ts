export interface CalendarCell {
  dateKey: string;
  day: number;
}

export function buildMonthGrid(year: number, month: number): (CalendarCell | null)[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingEmpty = firstOfMonth.getUTCDay();

  const cells: (CalendarCell | null)[] = [];
  for (let i = 0; i < leadingEmpty; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ dateKey, day });
  }
  return cells;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month: month - 1, day };
}
