export type StaticHoliday = {
    holiday_date: string;
    name: string;
    country_code: "PT";
    region: string | null;
};

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
    const regionalManual: StaticHoliday[] = [
        {
            holiday_date: `${yearValue}-06-24`,
            name: "São João",
            country_code: "PT",
            region: "porto",
        },
        {
            holiday_date: `${yearValue}-06-29`,
            name: "São Pedro",
            country_code: "PT",
            region: "povoa",
        },
    ];

    return [...nationalFixed, ...regionalManual];
}
