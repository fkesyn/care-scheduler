import { createClient } from "@/lib/supabase/server";
import { fetchPortugueseHolidays } from "@/lib/holidays/fetch-portuguese-holidays";

type SyncHolidayRow = {
    id: string;
    holiday_date: string;
    name: string;
    country_code: string;
    region: string | null;
};

function holidayKey(
    countryCode: string,
    region: string | null,
    holidayDate: string
) {
    return `${countryCode}:${region ?? "__national__"}:${holidayDate}`;
}

function manualRegionalHolidays(year: number) {
    const yearValue = String(year);

    return [
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
}

function fallbackNationalPortugueseHolidays(year: number) {
    const yearValue = String(year);

    return [
        { holiday_date: `${yearValue}-01-01`, name: "Ano Novo" },
        { holiday_date: `${yearValue}-04-25`, name: "Dia da Liberdade" },
        { holiday_date: `${yearValue}-05-01`, name: "Dia do Trabalhador" },
        { holiday_date: `${yearValue}-06-10`, name: "Dia de Portugal" },
        { holiday_date: `${yearValue}-08-15`, name: "Assunção de Nossa Senhora" },
        { holiday_date: `${yearValue}-10-05`, name: "Implantação da República" },
        { holiday_date: `${yearValue}-11-01`, name: "Dia de Todos os Santos" },
        { holiday_date: `${yearValue}-12-01`, name: "Restauração da Independência" },
        { holiday_date: `${yearValue}-12-08`, name: "Imaculada Conceição" },
        { holiday_date: `${yearValue}-12-25`, name: "Natal" },
    ].map((holiday) => ({
        ...holiday,
        country_code: "PT",
        region: null as string | null,
    }));
}

export async function syncPortugueseHolidays(
    year: number,
    providedSupabase?: Awaited<ReturnType<typeof createClient>>
) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return {
            insertedCount: 0,
            updatedCount: 0,
        };
    }

    const supabase = providedSupabase ?? (await createClient());
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    let apiHolidays: Awaited<ReturnType<typeof fetchPortugueseHolidays>> = [];
    let apiFailed = false;

    try {
        apiHolidays = await fetchPortugueseHolidays(year);
    } catch {
        apiFailed = true;
    }
    const desiredRows = [
        ...(apiFailed
            ? fallbackNationalPortugueseHolidays(year)
            : apiHolidays.map((holiday) => ({
                  holiday_date: holiday.holidayDate,
                  name: holiday.name,
                  country_code: "PT",
                  region: null as string | null,
              }))),
        ...manualRegionalHolidays(year),
    ];
    const dedupedDesiredRows = new Map<
        string,
        {
            holiday_date: string;
            name: string;
            country_code: string;
            region: string | null;
        }
    >();

    for (const row of desiredRows) {
        dedupedDesiredRows.set(
            holidayKey(row.country_code, row.region, row.holiday_date),
            row
        );
    }

    const { data: existingRows, error: existingError } = await supabase
        .from("public_holidays")
        .select("id, holiday_date, name, country_code, region")
        .eq("country_code", "PT")
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate);

    if (existingError) {
        throw new Error(
            `Não consegui ler feriados existentes: ${existingError.message}`
        );
    }

    const existing = (existingRows ?? []) as SyncHolidayRow[];
    const existingByKey = new Map<string, SyncHolidayRow>();
    const duplicateIdsToDelete: string[] = [];

    for (const row of existing) {
        const key = holidayKey(row.country_code, row.region, row.holiday_date);
        const existingKeyRow = existingByKey.get(key);

        if (existingKeyRow) {
            duplicateIdsToDelete.push(row.id);
            continue;
        }

        existingByKey.set(key, row);
    }

    if (duplicateIdsToDelete.length > 0) {
        await supabase.from("public_holidays").delete().in("id", duplicateIdsToDelete);
    }

    const rowsToInsert: Array<{
        holiday_date: string;
        name: string;
        country_code: string;
        region: string | null;
    }> = [];
    const rowsToUpdate: Array<{ id: string; name: string }> = [];

    for (const [key, row] of dedupedDesiredRows) {
        const existingRow = existingByKey.get(key);

        if (!existingRow) {
            rowsToInsert.push(row);
            continue;
        }

        if (existingRow.name !== row.name) {
            rowsToUpdate.push({
                id: existingRow.id,
                name: row.name,
            });
        }
    }

    if (rowsToInsert.length > 0) {
        const { error } = await supabase.from("public_holidays").insert(rowsToInsert);

        if (error) {
            throw new Error(`Não consegui inserir feriados: ${error.message}`);
        }
    }

    for (const row of rowsToUpdate) {
        const { error } = await supabase
            .from("public_holidays")
            .update({ name: row.name })
            .eq("id", row.id);

        if (error) {
            throw new Error(`Não consegui atualizar feriados: ${error.message}`);
        }
    }

    return {
        insertedCount: rowsToInsert.length,
        updatedCount: rowsToUpdate.length,
    };
}
