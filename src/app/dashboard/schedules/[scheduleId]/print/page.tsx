import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import {
    getHolidayForDateFromList,
    getHolidaysForDateRange,
} from "@/lib/holidays/get-holiday-for-date";
import { buildStaticPortugueseHolidays } from "@/lib/holidays/static-portuguese-holidays";
import { createClient } from "@/lib/supabase/server";
import { PrintControls } from "./print-controls";

type PrintSchedulePageProps = {
    params: Promise<{
        scheduleId: string;
    }>;
};

type Relation<T> = T | T[] | null;

type MonthlySchedule = {
    id: string;
    month: string;
    organization_id: string;
    locations: Relation<{
        id: string;
        name: string;
    }>;
};

type Employee = {
    id: string;
    name: string;
    display_order?: number | null;
};

type ShiftType = {
    id: string;
    code: string;
    name: string;
};

type ScheduleEntry = {
    employee_id: string;
    work_date: string;
    shift_types: Relation<{
        code: string;
    }>;
};

type ScheduleEmployeeFfDay = {
    employee_id: string;
    ff_days: number;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
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
        return {
            day,
            dateValue: formatDateValue(year, month, day),
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
        };
    });
}

function monthHeader(monthValue: string) {
    const [year, month] = monthValue.slice(0, 7).split("-").map(Number);
    const monthLabel = new Intl.DateTimeFormat("pt-PT", {
        month: "long",
    }).format(new Date(year, month - 1, 1));

    return `Mês: ${monthLabel.toUpperCase()} / ${year}`;
}

function cellKey(employeeId: string, dateValue: string) {
    return `${employeeId}:${dateValue}`;
}

function compactHolidayName(name: string) {
    return name.length > 10 ? `${name.slice(0, 10)}.` : name;
}

function printableShiftCode(code: string) {
    return code === "M*" ? "M" : code;
}

function employeePrintName(name: string) {
    return name.replace(/^enf\.?\s*/i, "").trim();
}

export default async function SchedulePrintPage({ params }: PrintSchedulePageProps) {
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
        month,
        organization_id,
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
            <div className="p-6 text-sm text-destructive">
                Erro ao carregar versão de impressão: {scheduleError.message}
            </div>
        );
    }

    if (!scheduleData) {
        notFound();
    }

    const schedule = scheduleData as MonthlySchedule;
    const days = buildMonthDays(schedule.month);
    const startDate = days[0]?.dateValue ?? schedule.month;
    const endDate = days[days.length - 1]?.dateValue ?? schedule.month;
    const [
        { data: employeesData, error: employeesError },
        { data: shiftTypesData, error: shiftTypesError },
        { data: entriesData, error: entriesError },
        { data: ffDaysData, error: ffDaysError },
        holidaysFromDb,
    ] = await Promise.all([
        supabase
            .from("employees")
            .select("id, name, display_order")
            .eq("active", true)
            .order("display_order")
            .order("name"),
        supabase.from("shift_types").select("id, code, name").order("display_order"),
        supabase
            .from("schedule_entries")
            .select(
                `
          employee_id,
          work_date,
          shift_types (
            code
          )
        `
            )
            .eq("schedule_id", schedule.id)
            .gte("work_date", startDate)
            .lte("work_date", endDate),
        supabase
            .from("employee_ff_balances")
            .select("employee_id, ff_days")
            .eq("organization_id", schedule.organization_id),
        getHolidaysForDateRange(startDate, endDate),
    ]);

    const loadError = employeesError ?? shiftTypesError ?? entriesError ?? ffDaysError;

    if (loadError) {
        return (
            <div className="p-6 text-sm text-destructive">
                Erro ao carregar dados do PDF: {loadError.message}
            </div>
        );
    }

    const employees = (employeesData ?? []) as Employee[];
    const shiftTypes = (shiftTypesData ?? []) as ShiftType[];
    const entries = (entriesData ?? []) as ScheduleEntry[];
    const ffDays = (ffDaysData ?? []) as ScheduleEmployeeFfDay[];
    const fallbackHolidays = buildStaticPortugueseHolidays(
        Number(schedule.month.slice(0, 4))
    ).filter(
        (holiday) => holiday.holiday_date >= startDate && holiday.holiday_date <= endDate
    );
    const holidays = [
        ...holidaysFromDb,
        ...fallbackHolidays.filter(
            (fallbackHoliday) =>
                !holidaysFromDb.some(
                    (dbHoliday) =>
                        dbHoliday.holiday_date === fallbackHoliday.holiday_date &&
                        (dbHoliday.region ?? null) === (fallbackHoliday.region ?? null)
                )
        ),
    ];
    const entryByCell = new Map<string, string>();
    const ffCountByEmployee = new Map(
        ffDays.map((row) => [row.employee_id, row.ff_days])
    );
    const holidayByDate = new Map<
        string,
        {
            holiday_date: string;
            name: string;
            country_code: string;
            region: string | null;
        }
    >();

    for (const entry of entries) {
        const shiftType = firstRelation(entry.shift_types);
        const shiftCode = shiftType?.code ?? "-";
        entryByCell.set(cellKey(entry.employee_id, entry.work_date), shiftCode);
    }

    for (const day of days) {
        const holiday = getHolidayForDateFromList(holidays, day.dateValue);

        if (holiday) {
            holidayByDate.set(day.dateValue, holiday);
        }
    }

    const location = firstRelation(schedule.locations);
    const logoCandidates = [
        "/votsf-logo.png",
        "/logo-votsf.png",
        "/votsf.png",
        "/brasao-votsf.png",
    ];
    const logoSrc =
        logoCandidates.find((candidate) =>
            existsSync(join(process.cwd(), "public", candidate.replace(/^\//, "")))
        ) ?? null;

    return (
        <div className="print-page p-2">
            <PrintControls />
            <div className="print-controls print-back-controls mb-4">
                <Link
                    href={`/dashboard/schedules/${schedule.id}`}
                    className="print-back-link text-sm underline"
                >
                    Voltar ao horário
                </Link>
            </div>

            <div className="print-preview-scroll">
                <section className="print-sheet">
                    <header className="print-header">
                        <div className="header-mark" aria-hidden="true">
                            {logoSrc ? (
                                <Image
                                    src={logoSrc}
                                    alt=""
                                    className="header-logo"
                                    width={68}
                                    height={68}
                                    unoptimized
                                />
                            ) : (
                                "VOTSF"
                            )}
                        </div>
                        <div className="header-text">
                            <p className="line">
                                Venerável Ordem Terceira de São Francisco de Vila do Conde
                            </p>
                            <p className="line strong">Escala de Enfermeiro de Serviço</p>
                            <p className="line">Equipa Enfermagem</p>
                            <p className="line small">
                                {location?.name ?? "Geral / todos os locais"}
                            </p>
                        </div>
                    </header>

                    <div className="table-wrap">
                        <table className="schedule-table">
                            <thead>
                                <tr>
                                    <th className="name-col section-title" rowSpan={2}>
                                        Equipa<br />Enfermagem
                                    </th>
                                    <th className="month-title" colSpan={days.length}>
                                        {monthHeader(schedule.month).replace(
                                            "Mês: ",
                                            "Mês:"
                                        )}
                                    </th>
                                </tr>
                                <tr>
                                    {days.map((day) => {
                                        const holiday = holidayByDate.get(day.dateValue);
                                        return (
                                            <th
                                                key={day.dateValue}
                                                className={[
                                                    "day-col",
                                                    day.isWeekend ? "weekend" : "",
                                                    holiday ? "holiday" : "",
                                                ].join(" ")}
                                            >
                                                <div>{day.day}</div>
                                                {holiday ? (
                                                    <div className="holiday-name">
                                                        {compactHolidayName(holiday.name)}
                                                    </div>
                                                ) : null}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((employee) => (
                                    <tr key={employee.id}>
                                        <td className="name-col employee-name">
                                            <span>Enf.{employeePrintName(employee.name)}</span>
                                            <span className="ff-count">
                                                ({ffCountByEmployee.get(employee.id) ?? 0}
                                                FF)
                                            </span>
                                        </td>
                                        {days.map((day) => {
                                            const holiday = holidayByDate.get(
                                                day.dateValue
                                            );
                                            const code =
                                                entryByCell.get(
                                                    cellKey(employee.id, day.dateValue)
                                                ) ?? "-";

                                            return (
                                                <td
                                                    key={`${employee.id}-${day.dateValue}`}
                                                    className={[
                                                        "cell",
                                                        day.isWeekend ? "weekend" : "",
                                                        holiday ? "holiday" : "",
                                                    ].join(" ")}
                                                >
                                                    <span
                                                        className={
                                                            code === "M*"
                                                                ? "print-code print-code-medication"
                                                                : "print-code"
                                                        }
                                                    >
                                                        {printableShiftCode(code)}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="footer-separator" />
                    <div className="print-footer-grid">
                        <section className="legend-box">
                            <p className="legend-title">Legenda</p>
                            <table className="legend-table">
                                <tbody>
                                    <tr>
                                        <td className="code">M</td>
                                        <td>Manhã (08h00-15h00)</td>
                                        <td className="code strong">M</td>
                                        <td>Turno de apoio medicação</td>
                                    </tr>
                                    <tr>
                                        <td className="code">T</td>
                                        <td>Tarde (13h00-20h00)</td>
                                        <td className="code">E</td>
                                        <td>Turno 10h00-17h00</td>
                                    </tr>
                                    <tr>
                                        <td className="code">MT</td>
                                        <td>Manhã + Tarde (fim de semana)</td>
                                        <td className="code">E*</td>
                                        <td>Turno de gestão enfermagem</td>
                                    </tr>
                                    <tr>
                                        <td className="code">B</td>
                                        <td>Baixa/ Licença de Maternidade</td>
                                        <td className="code">Fe</td>
                                        <td>Férias</td>
                                    </tr>
                                    <tr>
                                        <td className="code">FA</td>
                                        <td>Folga Aniversário</td>
                                        <td className="code">FF</td>
                                        <td>Folga em Falta (Compensação Feriado)</td>
                                    </tr>
                                    <tr>
                                        <td className="code">F</td>
                                        <td>Folga</td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>

                        <section className="notes-box">
                            <p className="notes-title">
                                Horário da equipa de Enfermagem:
                            </p>
                            <p>08:00 - 20:00</p>
                            <p>(sábados e domingos = 08:00 - 18:30)</p>
                            <p className="notes-title">Horário Visita Médica</p>
                            <p>Quartas e Sextas = 15:30 - 19:00</p>
                            <p className="notes-contact">Contacto: 936792189</p>
                        </section>
                    </div>

                    <p className="active-shifts">
                        Turnos ativos no sistema:{" "}
                        {shiftTypes.map((shiftType) => shiftType.code).join(", ") ||
                            "-"}
                    </p>

                    {/* TODO: Estruturar segunda página para compensações de feriados por enfermeiro. */}
                </section>
            </div>

            <style>{`
                @page {
                    size: A4 landscape;
                    margin: 4mm;
                }

                .print-page {
                    width: 100%;
                    max-width: none;
                    margin: 0;
                }

                .print-preview-scroll {
                    width: 100%;
                }

                .print-sheet {
                    width: 100%;
                    font-size: 10px;
                    color: #111827;
                    font-family: "Times New Roman", Times, serif;
                }

                .print-header {
                    display: grid;
                    grid-template-columns: 78px 1fr;
                    gap: 12px;
                    align-items: start;
                    margin-bottom: 8px;
                }

                .header-mark {
                    width: 68px;
                    height: 68px;
                    border: 1px solid #111827;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                    background: #f9fafb;
                }

                .header-logo {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .header-text {
                    text-align: center;
                }

                .print-header .line {
                    margin: 0;
                    line-height: 1.2;
                }

                .print-header .strong {
                    font-weight: 700;
                }

                .print-header .month {
                    margin-top: 2px;
                    font-weight: 700;
                }

                .print-header .small {
                    font-size: 9px;
                    color: #4b5563;
                }

                .table-wrap {
                    overflow: hidden;
                    border: 1px solid #111827;
                }

                .schedule-table {
                    width: 100%;
                    table-layout: fixed;
                    border-collapse: collapse;
                }

                .schedule-table th,
                .schedule-table td {
                    border: 1px solid #1f2937;
                    text-align: center;
                    padding: 2px 1px;
                    height:50px;
                    line-height: 1;
                }

                .schedule-table .name-col {
                    width: 128px;
                    text-align: center;
                    font-weight: 600;
                    background: #f3f4f6;
                }

                .schedule-table .section-title {
                    font-size: 15px;
                    font-weight: 700;
                }

                .schedule-table .month-title {
                    font-size: 20px;
                    font-weight: 700;
                    background: #f3f4f6;
                }

                .schedule-table .employee-name {
                    font-size: 15px;
                    line-height: 1.2;
                }

                .schedule-table .employee-name .ff-count {
                    display: block;
                    font-size: 10px;
                    margin-top: 1px;
                }

                .schedule-table .day-col {
                    font-size: 15px;
                    font-weight: 700;
                }

                .schedule-table .holiday-name {
                    font-size: 8px;
                    margin-top: 1px;
                    color: #92400e;
                }

                .schedule-table .weekend:not(.holiday) {
                    background: #d1d5db;
                }

                .schedule-table .holiday {
                    background: #f7e6a3;
                }

                .print-code {
                    font-size: 15px;
                    display: inline-block;
                    min-width: 10px;
                }

                .print-code-medication {
                    font-weight: 800;
                    font-size: 18px;
                }

                .footer-separator {
                    margin: 16px 0 10px;
                    border-top: 2px solid #111827;
                }

                .print-footer-grid {
                    display: grid;
                    grid-template-columns: 1fr 0.62fr;
                    gap: 14px;
                    align-items: start;
                }

                .legend-box,
                .notes-box {
                    border: 1px solid #9ca3af;
                    font-size: 15px;
                }

                .legend-title,
                .notes-title {
                    margin: 0;
                    padding: 2px 6px;
                    font-weight: 700;
                    text-align: center;
                    background: #e5e7eb;
                }

                .legend-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .legend-table td {
                    border: 1px solid #d1d5db;
                    padding: 2px 4px;
                }

                .legend-table .code {
                    width: 28px;
                    text-align: center;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
                        "Liberation Mono", "Courier New", monospace;
                    font-weight: 600;
                }

                .legend-table .code.strong {
                    font-weight: 800;
                }

                .notes-box {
                    text-align: center;
                }

                .notes-box p {
                    margin: 0;
                    padding: 2px 4px;
                }

                .notes-contact {
                    margin-top: 2px;
                    font-weight: 700;
                    border-top: 1px solid #d1d5db;
                    background: #e5e7eb;
                }

                .active-shifts {
                    margin: 8px 0 0;
                    font-size: 9px;
                    color: #4b5563;
                }

                @media screen and (max-width: 768px),
                    screen and (pointer: coarse) and (orientation: landscape) and (max-height: 520px) {
                    body {
                        overflow: hidden;
                        background: #111827 !important;
                    }

                    main > .border-b.bg-card {
                        display: none !important;
                    }

                    .print-page {
                        width: 100vw;
                        height: 100svh;
                        min-height: 100svh;
                        overflow: hidden;
                        padding: 0 !important;
                        background: #111827;
                    }

                    .print-action-controls {
                        display: none !important;
                    }

                    .print-back-controls {
                        position: sticky;
                        top: 0;
                        z-index: 20;
                        display: flex;
                        margin: 0 !important;
                        padding: 8px;
                        background: #ffffff;
                        box-shadow: 0 1px 10px rgb(15 23 42 / 0.16);
                    }

                    .print-back-link {
                        display: flex;
                        width: 100%;
                        min-height: 40px;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        background: #ffffff;
                        color: #111827;
                        font-weight: 600;
                        text-decoration: none;
                    }

                    .print-preview-scroll {
                        width: 100vw;
                        height: calc(100svh - 56px);
                        overflow: auto;
                        padding: 0;
                        background: #111827;
                        -webkit-overflow-scrolling: touch;
                    }

                    .print-sheet {
                        width: 1120px;
                        min-width: 1120px;
                        margin: 0;
                        padding: 8px;
                        background: #ffffff;
                        box-shadow: none;
                    }
                }

                @media screen and (pointer: coarse) and (orientation: landscape) and (max-height: 520px) {
                    .print-back-controls {
                        padding: 4px 6px;
                    }

                    .print-back-link {
                        min-height: 32px;
                        font-size: 12px;
                    }

                    .print-preview-scroll {
                        height: calc(100svh - 40px);
                    }

                    .print-sheet {
                        width: 100vw;
                        min-width: 100vw;
                        padding: 4px;
                        font-size: 7px;
                    }

                    .print-header {
                        grid-template-columns: 34px 1fr;
                        gap: 6px;
                        margin-bottom: 3px;
                    }

                    .header-mark {
                        width: 30px;
                        height: 30px;
                        font-size: 6px;
                        border-radius: 3px;
                    }

                    .print-header .line {
                        font-size: 7px;
                        line-height: 1.05;
                    }

                    .print-header .small {
                        font-size: 6px;
                    }

                    .schedule-table th,
                    .schedule-table td {
                        height: 24px;
                        padding: 1px 0;
                    }

                    .schedule-table .name-col {
                        width: 70px;
                    }

                    .schedule-table .section-title {
                        font-size: 8px;
                    }

                    .schedule-table .month-title {
                        font-size: 10px;
                    }

                    .schedule-table .employee-name {
                        font-size: 8px;
                        line-height: 1.05;
                    }

                    .schedule-table .employee-name .ff-count {
                        font-size: 6px;
                        margin-top: 0;
                    }

                    .schedule-table .day-col {
                        font-size: 9px;
                    }

                    .schedule-table .holiday-name {
                        display: none;
                    }

                    .print-code {
                        min-width: 0;
                        font-size: 9px;
                    }

                    .print-code-medication {
                        font-size: 10px;
                    }

                    .footer-separator {
                        margin: 4px 0 3px;
                        border-top-width: 1px;
                    }

                    .print-footer-grid {
                        grid-template-columns: 1fr 0.55fr;
                        gap: 4px;
                    }

                    .legend-box,
                    .notes-box {
                        font-size: 7px;
                    }

                    .legend-title,
                    .notes-title {
                        padding: 1px 3px;
                    }

                    .legend-table td {
                        padding: 0 2px;
                    }

                    .legend-table .code {
                        width: 16px;
                    }

                    .notes-box p {
                        padding: 1px 2px;
                    }

                    .active-shifts {
                        display: none;
                    }
                }

                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    main > .border-b.bg-card {
                        display: none !important;
                    }

                    .print-controls {
                        display: none !important;
                    }

                    body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .print-page {
                        padding: 0 !important;
                    }

                    .print-preview-scroll {
                        overflow: visible !important;
                        padding: 0 !important;
                    }

                    .print-sheet {
                        width: 100% !important;
                        min-width: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                    }

                    .schedule-table .weekend:not(.holiday) {
                        background: #d1d5db !important;
                    }

                    .schedule-table .holiday {
                        background: #f7e6a3 !important;
                    }
                }
            `}</style>
        </div>
    );
}
