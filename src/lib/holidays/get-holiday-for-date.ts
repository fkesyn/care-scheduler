import { createClient } from "@/lib/supabase/server";

export type PublicHoliday = {
    holiday_date: string;
    name: string;
    country_code: string;
    region: string | null;
};

function normalizeRegion(region?: string | null) {
    const normalizedRegion = (region ?? "").trim().toLowerCase();
    return normalizedRegion || null;
}

export function getHolidayForDateFromList(
    holidays: PublicHoliday[],
    dateValue: string,
    region?: string | null
) {
    const normalizedRegion = normalizeRegion(region);
    const dateHolidays = holidays.filter(
        (holiday) => holiday.holiday_date === dateValue
    );

    if (normalizedRegion) {
        const regionalHoliday = dateHolidays.find(
            (holiday) => normalizeRegion(holiday.region) === normalizedRegion
        );

        if (regionalHoliday) {
            return regionalHoliday;
        }
    }

    return (
        dateHolidays.find((holiday) => !normalizeRegion(holiday.region)) ??
        dateHolidays[0] ??
        null
    );
}

export async function getHolidayForDate(dateValue: string, region?: string | null) {
    const supabase = await createClient();
    const normalizedRegion = normalizeRegion(region);
    let query = supabase
        .from("public_holidays")
        .select("holiday_date, name, country_code, region")
        .eq("country_code", "PT")
        .eq("holiday_date", dateValue);

    if (normalizedRegion) {
        query = query.in("region", [normalizedRegion, null]);
    }

    const { data, error } = await query;

    if (error) {
        return null;
    }

    const holidays = (data ?? []) as PublicHoliday[];
    return getHolidayForDateFromList(holidays, dateValue, normalizedRegion);
}

export async function getHolidaysForDateRange(startDate: string, endDate: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("public_holidays")
        .select("holiday_date, name, country_code, region")
        .eq("country_code", "PT")
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate)
        .order("holiday_date")
        .order("name");

    if (error) {
        return [] as PublicHoliday[];
    }

    return (data ?? []) as PublicHoliday[];
}
