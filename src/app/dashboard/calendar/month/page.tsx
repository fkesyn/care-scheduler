import Link from "next/link";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type MonthPageProps = {
    searchParams: Promise<{
        date?: string;
    }>;
};

type Appointment = {
    id: string;
    scheduled_date: string;
    start_time: string;
    patients: {
        name: string;
    } | null;
    services: {
        name: string;
        color: string | null;
    } | null;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseDate(dateValue: string) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function getMonthRange(dateValue: string) {
    const date = parseDate(dateValue);

    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    return {
        start,
        end,
        startValue: formatDateInput(start),
        endValue: formatDateInput(end),
    };
}

function addMonths(dateValue: string, months: number) {
    const date = parseDate(dateValue);
    date.setMonth(date.getMonth() + months);

    return formatDateInput(date);
}

function formatMonthLabel(dateValue: string) {
    const date = parseDate(dateValue);

    return new Intl.DateTimeFormat("pt-PT", {
        month: "long",
        year: "numeric",
    }).format(date);
}

function formatTime(timeValue: string) {
    return timeValue.slice(0, 5);
}

function buildMonthDays(selectedDate: string) {
    const { start, end } = getMonthRange(selectedDate);

    const firstDayOffset = start.getDay() === 0 ? 6 : start.getDay() - 1;
    const days: Array<{
        date: Date;
        dateValue: string;
        isCurrentMonth: boolean;
    }> = [];

    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - firstDayOffset);

    for (let i = 0; i < 42; i++) {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + i);

        days.push({
            date: day,
            dateValue: formatDateInput(day),
            isCurrentMonth: day.getMonth() === start.getMonth(),
        });
    }

    return {
        days,
        startValue: formatDateInput(start),
        endValue: formatDateInput(end),
    };
}

function firstRelation<T>(relation: T | T[] | null) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

export default async function CalendarMonthPage({ searchParams }: MonthPageProps) {
    await connection();

    const params = await searchParams;
    const selectedDate =
        params.date && datePattern.test(params.date)
            ? params.date
            : formatDateInput(new Date());

    const { days, startValue, endValue } = buildMonthDays(selectedDate);

    const supabase = await createClient();

    const { data, error } = await supabase
        .from("appointments")
        .select(
            `
        id,
        scheduled_date,
        start_time,
        patients (
          name
        ),
        services (
          name,
          color
        )
      `
        )
        .gte("scheduled_date", startValue)
        .lte("scheduled_date", endValue)
        .order("scheduled_date")
        .order("start_time");

    if (error) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold">Vista mensal</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar calendário mensal: {error.message}
                    </p>
                </div>
            </div>
        );
    }

    const appointments = (data ?? []) as Appointment[];

    const appointmentsByDate = new Map<string, Appointment[]>();

    for (const appointment of appointments) {
        const current = appointmentsByDate.get(appointment.scheduled_date) ?? [];
        current.push(appointment);
        appointmentsByDate.set(appointment.scheduled_date, current);
    }

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Calendário mensal</h1>
                        <p className="text-sm capitalize text-muted-foreground">
                            {formatMonthLabel(selectedDate)}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/calendar/month?date=${addMonths(selectedDate, -1)}`}>
                                Mês anterior
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="secondary">
                            <Link href={`/dashboard/calendar/month?date=${formatDateInput(new Date())}`}>
                                Este mês
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/calendar/month?date=${addMonths(selectedDate, 1)}`}>
                                Mês seguinte
                            </Link>
                        </Button>

                        <Button asChild size="sm">
                            <Link href={`/dashboard/calendar?date=${selectedDate}`}>
                                Ver dia
                            </Link>
                        </Button>
                    </div>
                </header>

                <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
                    <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                            <div key={day} className="p-3">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7">
                        {days.map((day) => {
                            const dayAppointments = appointmentsByDate.get(day.dateValue) ?? [];
                            const isToday = day.dateValue === formatDateInput(new Date());

                            return (
                                <Link
                                    key={day.dateValue}
                                    href={`/dashboard/calendar?date=${day.dateValue}`}
                                    className={[
                                        "min-h-32 border-b border-r p-2 transition-colors hover:bg-muted/50",
                                        !day.isCurrentMonth ? "bg-muted/20 text-muted-foreground" : "",
                                        isToday ? "bg-primary/5" : "",
                                    ].join(" ")}
                                >
                                    <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {day.date.getDate()}
                    </span>

                                        {dayAppointments.length > 0 ? (
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {dayAppointments.length}
                      </span>
                                        ) : null}
                                    </div>

                                    <div className="grid gap-1">
                                        {dayAppointments.slice(0, 3).map((appointment) => {
                                            const patient = firstRelation(appointment.patients);
                                            const service = firstRelation(appointment.services);

                                            return (
                                                <div
                                                    key={appointment.id}
                                                    className="truncate rounded-md border bg-background px-2 py-1 text-xs"
                                                >
                          <span
                              className="mr-1 inline-block size-2 rounded-full"
                              style={{
                                  backgroundColor: service?.color ?? "#0f766e",
                              }}
                          />
                                                    {formatTime(appointment.start_time)} ·{" "}
                                                    {patient?.name ?? "Utente"} ·{" "}
                                                    {service?.name ?? "Serviço"}
                                                </div>
                                            );
                                        })}

                                        {dayAppointments.length > 3 ? (
                                            <p className="text-xs text-muted-foreground">
                                                +{dayAppointments.length - 3} mais
                                            </p>
                                        ) : null}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
}