import { connection } from "next/server";
import { canManageData, getCurrentUserRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { mergeYearHolidays } from "@/lib/holidays/year-holidays";
import { HolidayManager, type EmployeeHoliday } from "./holiday-manager";

export default async function HolidaysPage({ searchParams }: {
    searchParams: Promise<{ year?: string; employee?: string }>;
}) {
    await connection();
    const params = await searchParams;
    const requestedYear = Number(params.year);
    const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : new Date().getFullYear();
    const supabase = await createClient();
    const [role, employeesResult, holidaysResult] = await Promise.all([
        getCurrentUserRole(),
        supabase.from("employees").select("id, name").eq("role", "nurse").order("display_order").order("name"),
        supabase.from("public_holidays").select("holiday_date, name, country_code, region").eq("country_code", "PT").gte("holiday_date", `${year}-01-01`).lte("holiday_date", `${year}-12-31`),
    ]);
    // Supabase caps individual responses; load the full ledger for accurate totals.
    const records: EmployeeHoliday[] = [];
    let loadError = employeesResult.error?.message || holidaysResult.error?.message;
    for (let offset = 0; !loadError; offset += 1000) {
        const { data, error } = await supabase.from("employee_holidays")
            .select("id, employee_id, name, holiday_date, notes, source, source_date, source_unit, used_date, used_schedule_id")
            .order("created_at").order("id").range(offset, offset + 999);
        if (error) { loadError = error.message; break; }
        records.push(...(data as EmployeeHoliday[]));
        if (data.length < 1000) break;
    }
    return <div className="p-6"><div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header><h1 className="text-2xl font-semibold tracking-tight">Gestor de feriados</h1>
            <p className="mt-2 text-sm text-muted-foreground">Feriados trabalhados, dias disponíveis e compensações usadas. O calendário só contabiliza os feriados ao validar o horário.</p></header>
        {loadError ? <p role="alert" className="text-sm text-destructive">Não consegui carregar os feriados: {loadError}</p> :
            <HolidayManager key={`${year}:${params.employee ?? ""}`} year={year} initialEmployee={params.employee ?? ""}
                employees={employeesResult.data ?? []} holidays={mergeYearHolidays(year, holidaysResult.data ?? [])}
                records={records} canManage={canManageData(role)} />}
    </div></div>;
}
