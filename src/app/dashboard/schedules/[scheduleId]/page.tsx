import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FileDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getHolidayForDateFromList } from "@/lib/holidays/get-holiday-for-date";
import { buildStaticPortugueseHolidays } from "@/lib/holidays/static-portuguese-holidays";
import { syncPortugueseHolidays } from "@/lib/holidays/sync-portuguese-holidays";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ClearScheduleGridDialog } from "../clear-schedule-grid-dialog";
import { GenerateScheduleDialog } from "../generate-schedule-dialog";
import { GenerationWarningsSection } from "../generation-warnings-section";
import { ImportConstraintsDialog } from "../import-constraints-dialog";
import {
    ClearConstraintsDialog,
    NewConstraintDialog,
    ScheduleConstraintsSection,
    type ScheduleConstraintEmployee,
    type ScheduleConstraintRow,
    type ScheduleConstraintShiftType,
} from "../schedule-constraints-section";
import {
    ScheduleGrid,
    type ScheduleGridConstraint,
    type ScheduleGridEmployee,
    type ScheduleGridEntry,
    type ScheduleGridShiftType,
} from "../schedule-grid";

type ScheduleDetailPageProps = {
    params: Promise<{
        scheduleId: string;
    }>;
};

type Relation<T> = T | T[] | null;

type Location = {
    id: string;
    name: string;
};

type MonthlySchedule = {
    id: string;
    location_id: string | null;
    month: string;
    created_at: string | null;
    updated_at: string | null;
    locations: Relation<Location>;
};

type Employee = {
    id: string;
    name: string;
    role: string;
    active: boolean | null;
    display_order?: number | null;
};

type ShiftType = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    active: boolean | null;
    display_order: number | null;
};

type ScheduleEntry = {
    id: string;
    employee_id: string;
    shift_type_id: string;
    work_date: string;
    notes: string | null;
    shift_types: Relation<{
        id: string;
        code: string;
        name: string;
    }>;
};

type ScheduleGenerationWarning = {
    id: string;
    schedule_id: string;
    employee_id: string | null;
    message: string;
    resolved: boolean;
    shift_type_id: string | null;
    work_date: string;
    employees: Relation<{
        id: string;
        name: string;
    }>;
    shift_types: Relation<{
        id: string;
        code: string;
        name: string;
    }>;
};

type PublicHoliday = {
    holiday_date: string;
    name: string;
    country_code: string;
    region: string | null;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function formatMonthLabel(monthValue: string) {
    const [year, month] = monthValue.slice(0, 7).split("-").map(Number);

    return new Intl.DateTimeFormat("pt-PT", {
        month: "long",
        year: "numeric",
    }).format(new Date(year, month - 1, 1));
}

function formatDateValue(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
    )}`;
}

function buildMonthDays(monthValue: string) {
    const [year, month] = monthValue.slice(0, 7).split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    return Array.from({ length: lastDay }, (_, index) => {
        const day = index + 1;
        const date = new Date(year, month - 1, day);
        const weekday = new Intl.DateTimeFormat("pt-PT", {
            weekday: "short",
        }).format(date);

        return {
            date,
            dateValue: formatDateValue(year, month, day),
            day,
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            weekday,
        };
    });
}

export default async function ScheduleDetailPage({
    params,
}: ScheduleDetailPageProps) {
    await connection();

    const { scheduleId } = await params;

    if (!uuidPattern.test(scheduleId)) {
        notFound();
    }

    const supabase = await createClient();
    const { data: scheduleData, error: scheduleError } = await supabase
        .from("monthly_schedules")
        .select(
            `
        id,
        location_id,
        month,
        created_at,
        updated_at,
        locations (
          id,
          name
        )
      `
        )
        .eq("id", scheduleId)
        .maybeSingle();

    if (scheduleError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Horário mensal
                    </h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar horário: {scheduleError.message}
                    </p>
                </div>
            </div>
        );
    }

    if (!scheduleData) {
        notFound();
    }

    const schedule = scheduleData as MonthlySchedule;
    try {
        await syncPortugueseHolidays(Number(schedule.month.slice(0, 4)), supabase);
    } catch {
        // Keep UI usable with whatever holiday rows already exist in DB.
    }

    const days = buildMonthDays(schedule.month);
    const monthValue = schedule.month.slice(0, 7);
    const startValue = days[0]?.dateValue ?? schedule.month;
    const endValue = days[days.length - 1]?.dateValue ?? schedule.month;

    const [
        { data: employees, error: employeesError },
        { data: shiftTypes, error: shiftTypesError },
        { data: entries, error: entriesError },
        { data: constraints, error: constraintsError },
        { data: generationWarnings, error: generationWarningsError },
        { data: holidaysData, error: holidaysError },
    ] = await Promise.all([
        supabase
            .from("employees")
            .select("id, name, role, active, display_order")
            .eq("active", true)
            .order("display_order")
            .order("name"),
        supabase
            .from("shift_types")
            .select("id, code, name, description, active, display_order")
            .order("display_order")
            .order("code"),
        supabase
            .from("schedule_entries")
            .select(
                `
        id,
        employee_id,
        shift_type_id,
        work_date,
        notes,
        shift_types (
          id,
          code,
          name
        )
      `
            )
            .eq("schedule_id", schedule.id)
            .gte("work_date", startValue)
            .lte("work_date", endValue)
            .order("work_date")
            .order("created_at"),
        supabase
            .from("employee_schedule_constraints")
            .select(
                `
        id,
        employee_id,
        constraint_type,
        shift_type_id,
        specific_date,
        start_date,
        end_date,
        notes,
        source_text,
        shift_types (
          id,
          code,
          name
        )
      `
            )
            .eq("month", schedule.month)
            .order("created_at"),
        supabase
            .from("schedule_generation_warnings")
            .select(
                `
        id,
        schedule_id,
        employee_id,
        work_date,
        shift_type_id,
        message,
        resolved,
        employees (
          id,
          name
        ),
        shift_types (
          id,
          code,
          name
        )
      `
            )
            .eq("schedule_id", schedule.id)
            .order("work_date")
            .order("created_at"),
        supabase
            .from("public_holidays")
            .select("holiday_date, name, country_code, region")
            .eq("country_code", "PT")
            .gte("holiday_date", startValue)
            .lte("holiday_date", endValue),
    ]);

    const loadError =
        employeesError ??
        shiftTypesError ??
        entriesError ??
        constraintsError ??
        generationWarningsError ??
        holidaysError;

    if (loadError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Horário mensal
                    </h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar grelha: {loadError.message}
                    </p>
                </div>
            </div>
        );
    }

    const employeeRows = (employees ?? []) as Employee[];
    const shiftTypeRows = (shiftTypes ?? []) as ShiftType[];
    const entryRows = (entries ?? []) as ScheduleEntry[];
    const constraintRows = (constraints ?? []) as ScheduleConstraintRow[];
    const generationWarningRows =
        (generationWarnings ?? []) as ScheduleGenerationWarning[];
    const holidayRowsFromDb = (holidaysData ?? []) as PublicHoliday[];
    const fallbackHolidayRows = buildStaticPortugueseHolidays(
        Number(schedule.month.slice(0, 4))
    ).filter(
        (holiday) => holiday.holiday_date >= startValue && holiday.holiday_date <= endValue
    );
    const holidayRows = [
        ...holidayRowsFromDb,
        ...fallbackHolidayRows.filter(
            (fallbackHoliday) =>
                !holidayRowsFromDb.some(
                    (dbHoliday) =>
                        dbHoliday.holiday_date === fallbackHoliday.holiday_date &&
                        (dbHoliday.region ?? null) === (fallbackHoliday.region ?? null)
                )
        ),
    ];
    const gridEmployees: ScheduleGridEmployee[] = employeeRows.map((employee) => ({
        id: employee.id,
        name: employee.name,
        role: employee.role,
    }));
    const gridDays = days.map((day) => {
        const holiday = getHolidayForDateFromList(holidayRows, day.dateValue);

        return {
            ...day,
            holidayName: holiday?.name ?? null,
            isHoliday: Boolean(holiday),
        };
    });
    const gridShiftTypes: ScheduleGridShiftType[] = shiftTypeRows.map(
        (shiftType) => ({
            active: shiftType.active,
            code: shiftType.code,
            id: shiftType.id,
            name: shiftType.name,
        })
    );
    const gridEntries: ScheduleGridEntry[] = entryRows.map((entry) => ({
        employee_id: entry.employee_id,
        id: entry.id,
        notes: entry.notes,
        shift_type_id: entry.shift_type_id,
        work_date: entry.work_date,
    }));
    const gridConstraints: ScheduleGridConstraint[] = constraintRows.map(
        (constraint) => ({
            constraint_type: constraint.constraint_type,
            employee_id: constraint.employee_id,
            end_date: constraint.end_date,
            id: constraint.id,
            notes: constraint.notes,
            shift_type_id: constraint.shift_type_id,
            source_text: constraint.source_text,
            specific_date: constraint.specific_date,
            start_date: constraint.start_date,
        })
    );
    const constraintEmployees: ScheduleConstraintEmployee[] = employeeRows.map(
        (employee) => ({
            id: employee.id,
            name: employee.name,
            role: employee.role,
        })
    );
    const constraintShiftTypes: ScheduleConstraintShiftType[] = shiftTypeRows
        .filter((shiftType) => shiftType.active !== false)
        .map((shiftType) => ({
            active: shiftType.active,
            code: shiftType.code,
            id: shiftType.id,
            name: shiftType.name,
        }));
    const location = firstRelation(schedule.locations);

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight capitalize">
                            {formatMonthLabel(schedule.month)}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {location?.name ?? "Geral / todos os locais"} ·{" "}
                            {employeeRows.length}{" "}
                            {employeeRows.length === 1 ? "pessoa" : "pessoas"} na grelha
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href={`/dashboard/schedules?month=${monthValue}`}>
                                Voltar à lista
                            </Link>
                        </Button>
                    </div>
                </header>

                <section className="rounded-lg border bg-card p-4 shadow-xs">
                    <div className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-medium">Tipos de turno</h2>
                            <p className="text-xs text-muted-foreground">
                                Códigos iniciais para preencher horários mensais.
                            </p>
                        </div>

                        {shiftTypeRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Ainda não há tipos de turno configurados.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {shiftTypeRows.map((shiftType) => (
                                    <span
                                        key={shiftType.id}
                                        className={cn(
                                            "inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-xs",
                                            !shiftType.active && "opacity-50"
                                        )}
                                    >
                                        <span className="font-mono font-semibold">
                                            {shiftType.code}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {shiftType.name}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <GenerationWarningsSection warnings={generationWarningRows} />

                <ScheduleGrid
                    constraints={gridConstraints}
                    days={gridDays}
                    employees={gridEmployees}
                    entries={gridEntries}
                    scheduleId={schedule.id}
                    shiftTypes={gridShiftTypes}
                />

                <section className="rounded-lg border bg-card p-4 shadow-xs">
                    <div className="grid gap-3">
                        <div className="flex flex-wrap gap-2">
                            <GenerateScheduleDialog scheduleId={schedule.id} />
                            <Button asChild variant="outline">
                                <Link
                                    href={`/dashboard/schedules/${schedule.id}/print`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <FileDownIcon />
                                    Exportar PDF
                                </Link>
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <NewConstraintDialog
                                employees={constraintEmployees}
                                monthEnd={endValue}
                                monthStart={startValue}
                                scheduleId={schedule.id}
                                shiftTypes={constraintShiftTypes}
                            />
                            <ImportConstraintsDialog
                                employees={constraintEmployees}
                                monthEnd={endValue}
                                monthStart={startValue}
                                scheduleId={schedule.id}
                                shiftTypes={constraintShiftTypes}
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <ClearConstraintsDialog
                                constraintsCount={constraintRows.length}
                                scheduleId={schedule.id}
                            />
                            <ClearScheduleGridDialog
                                entriesCount={entryRows.length}
                                scheduleId={schedule.id}
                            />
                        </div>
                    </div>
                </section>

                <ScheduleConstraintsSection
                    constraints={constraintRows}
                    employees={constraintEmployees}
                    monthEnd={endValue}
                    monthStart={startValue}
                    scheduleId={schedule.id}
                    showHeaderActions={false}
                    shiftTypes={constraintShiftTypes}
                />
            </div>
        </div>
    );
}
