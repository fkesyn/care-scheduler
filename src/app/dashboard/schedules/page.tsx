import { CalendarIcon, EyeIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { NewScheduleDialog } from "./new-schedule-dialog";
import { ScheduleRowActions } from "./schedule-row-actions";

type SchedulesPageProps = {
    searchParams: Promise<{
        month?: string;
    }>;
};

type Location = {
    id: string;
    name: string;
};

type Relation<T> = T | T[] | null;

type MonthlySchedule = {
    id: string;
    location_id: string | null;
    month: string;
    status: string;
    created_at: string | null;
    updated_at: string | null;
    locations: Relation<Location>;
};

const monthPattern = /^\d{4}-\d{2}$/;

function currentMonthValue() {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeMonth(month?: string) {
    if (!month || !monthPattern.test(month)) {
        return currentMonthValue();
    }

    const monthNumber = Number(month.slice(5, 7));

    if (monthNumber < 1 || monthNumber > 12) {
        return currentMonthValue();
    }

    return month;
}

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function statusLabel(status: string) {
    if (status === "published") {
        return "Publicado";
    }

    if (status === "archived") {
        return "Arquivado";
    }

    return "Rascunho";
}

function statusVariant(status: string) {
    if (status === "published") {
        return "secondary" as const;
    }

    if (status === "archived") {
        return "outline" as const;
    }

    return "default" as const;
}

function formatMonthLabel(monthValue: string) {
    const [year, month] = monthValue.split("-").map(Number);

    return new Intl.DateTimeFormat("pt-PT", {
        month: "long",
        year: "numeric",
    }).format(new Date(year, month - 1, 1));
}

function formatDateTime(dateValue: string | null) {
    if (!dateValue) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-PT", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(dateValue));
}

export default async function SchedulesPage({ searchParams }: SchedulesPageProps) {
    await connection();

    const params = await searchParams;
    const selectedMonth = normalizeMonth(params.month);
    const selectedMonthStart = `${selectedMonth}-01`;
    const supabase = await createClient();

    const [
        { data: locations, error: locationsError },
        { data: schedules, error: schedulesError },
    ] = await Promise.all([
        supabase.from("locations").select("id, name").order("name"),
        supabase
            .from("monthly_schedules")
            .select(
                `
        id,
        location_id,
        month,
        status,
        created_at,
        updated_at,
        locations (
          id,
          name
        )
      `
            )
            .eq("month", selectedMonthStart)
            .order("created_at", { ascending: false }),
    ]);

    const loadError = locationsError ?? schedulesError;

    if (loadError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Horários mensais
                    </h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar horários: {loadError.message}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Confirma que a migration{" "}
                        <code>20260525100000_employee_monthly_schedules.sql</code>{" "}
                        já foi aplicada.
                    </p>
                </div>
            </div>
        );
    }

    const locationRows = (locations ?? []) as Location[];
    const scheduleRows = (schedules ?? []) as MonthlySchedule[];

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Horários mensais
                        </h1>
                        <p className="text-sm capitalize text-muted-foreground">
                            {formatMonthLabel(selectedMonth)} · {scheduleRows.length}{" "}
                            {scheduleRows.length === 1
                                ? "horário registado"
                                : "horários registados"}
                        </p>
                    </div>

                    <NewScheduleDialog
                        defaultMonth={selectedMonth}
                        locations={locationRows}
                    />
                </header>

                <section className="rounded-lg border bg-card p-4 shadow-xs">
                    <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="grid gap-2">
                            <Label htmlFor="schedule-month-filter">Mês</Label>
                            <Input
                                id="schedule-month-filter"
                                name="month"
                                type="month"
                                defaultValue={selectedMonth}
                            />
                        </div>
                        <Button type="submit" variant="outline">
                            <CalendarIcon />
                            Ver mês
                        </Button>
                    </form>
                </section>

                <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
                    {scheduleRows.length === 0 ? (
                        <div className="flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                            Ainda não há horários mensais para este mês.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Mês</TableHead>
                                    <TableHead>Local</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Atualizado</TableHead>
                                    <TableHead className="text-right">Abrir</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {scheduleRows.map((schedule) => {
                                    const location = firstRelation(schedule.locations);

                                    return (
                                        <TableRow key={schedule.id}>
                                            <TableCell className="font-medium capitalize">
                                                {formatMonthLabel(schedule.month.slice(0, 7))}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {location?.name ?? "Geral / todos os locais"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(schedule.status)}>
                                                    {statusLabel(schedule.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDateTime(
                                                    schedule.updated_at ?? schedule.created_at
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild size="sm" variant="outline">
                                                    <Link href={`/dashboard/schedules/${schedule.id}`}>
                                                        <EyeIcon />
                                                        Abrir
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <ScheduleRowActions
                                                    locations={locationRows}
                                                    schedule={schedule}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </section>
            </div>
        </div>
    );
}
