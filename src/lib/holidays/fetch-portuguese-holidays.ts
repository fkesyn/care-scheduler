export type PortugueseHolidayApiItem = {
    date: string;
    localName: string;
    name: string;
};

export type PortugueseHolidayItem = {
    holidayDate: string;
    name: string;
};

function normalizeHolidayName(item: PortugueseHolidayApiItem) {
    return (item.localName || item.name || "").trim();
}

function isIsoDate(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function fetchPortugueseHolidays(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new Error("Ano inválido para sincronizar feriados.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const response = await fetch(
            `https://date.nager.at/api/v3/PublicHolidays/${year}/PT`,
            {
                cache: "no-store",
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            throw new Error(`API de feriados falhou (${response.status}).`);
        }

        const payload = (await response.json()) as unknown;

        if (!Array.isArray(payload)) {
            throw new Error("API de feriados devolveu formato inválido.");
        }

        const holidays: PortugueseHolidayItem[] = [];

        for (const item of payload) {
            if (typeof item !== "object" || item === null) {
                continue;
            }

            const dateValue =
                "date" in item && typeof item.date === "string" ? item.date : "";
            const name = normalizeHolidayName(item as PortugueseHolidayApiItem);

            if (!isIsoDate(dateValue) || !name) {
                continue;
            }

            holidays.push({
                holidayDate: dateValue,
                name,
            });
        }

        return holidays;
    } finally {
        clearTimeout(timeout);
    }
}
