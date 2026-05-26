export type StaticHoliday = {
    holiday_date: string;
    name: string;
    country_code: "PT";
    region: string | null;
};

function formatDateValue(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function easterSundayUtc(year: number) {
    // Meeus/Jones/Butcher algorithm (Gregorian calendar).
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUtc(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

export function buildStaticPortugueseHolidays(year: number): StaticHoliday[] {
    const yearValue = String(year);

    const nationalFixed: StaticHoliday[] = [
        { holiday_date: `${yearValue}-01-01`, name: "Ano Novo", country_code: "PT", region: null },
        {
            holiday_date: `${yearValue}-04-25`,
            name: "Dia da Liberdade",
            country_code: "PT",
            region: null,
        },
        {
            holiday_date: `${yearValue}-05-01`,
            name: "Dia do Trabalhador",
            country_code: "PT",
            region: null,
        },
        {
            holiday_date: `${yearValue}-06-10`,
            name: "Dia de Portugal",
            country_code: "PT",
            region: null,
        },
        {
            holiday_date: `${yearValue}-08-15`,
            name: "Assunção de Nossa Senhora",
            country_code: "PT",
            region: null,
        },
        {
            holiday_date: `${yearValue}-10-05`,
            name: "Implantação da República",
            country_code: "PT",
            region: null,
        },
        {
            holiday_date: `${yearValue}-11-01`,
            name: "Dia de Todos os Santos",
            country_code: "PT",
            region: null,
        },
        {
            holiday_date: `${yearValue}-12-01`,
            name: "Restauração da Independência",
            country_code: "PT",
            region: null,
        },
        {
            holiday_date: `${yearValue}-12-08`,
            name: "Imaculada Conceição",
            country_code: "PT",
            region: null,
        },
        { holiday_date: `${yearValue}-12-25`, name: "Natal", country_code: "PT", region: null },
    ];
    const easterSunday = easterSundayUtc(year);
    const nationalMovable: StaticHoliday[] = [
        {
            holiday_date: formatDateValue(addDaysUtc(easterSunday, -2)),
            name: "Sexta-feira Santa",
            country_code: "PT",
            region: null,
        },
        {
            holiday_date: formatDateValue(addDaysUtc(easterSunday, 60)),
            name: "Corpo de Deus",
            country_code: "PT",
            region: null,
        },
    ];
    const regionalManual: StaticHoliday[] = [
        {
            holiday_date: `${yearValue}-06-24`,
            name: "São João",
            country_code: "PT",
            region: "porto",
        },
    ];

    return [...nationalFixed, ...nationalMovable, ...regionalManual];
}
