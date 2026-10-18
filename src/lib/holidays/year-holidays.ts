import { buildStaticPortugueseHolidays } from "./static-portuguese-holidays";
import type { PublicHoliday } from "./get-holiday-for-date";

// Keep the manager and validation on the same calendar, including offline dates.
export function mergeYearHolidays(year: number, stored: PublicHoliday[]) {
    const byDate = new Map<string, PublicHoliday>();
    for (const holiday of [...buildStaticPortugueseHolidays(year), ...stored]) {
        byDate.set(holiday.holiday_date, holiday);
    }
    return [...byDate.values()].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
}
