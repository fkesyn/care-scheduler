import { connection } from "next/server";
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

type Location = {
    id: string;
    name: string;
};

type MonthlySchedule = {
    id: string;
    month: string;
    created_at: string | null;
    updated_at: string | null;
};

function currentMonthValue() {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function normalizeLocationNameForMatch(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

export default async function SchedulesPage() {
    await connection();
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
        month,
        created_at,
        updated_at
      `
            )
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
    const defaultLocation =
        locationRows.find((location) =>
            normalizeLocationNameForMatch(location.name).includes("sao francisco")
        ) ?? null;

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Horários mensais
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {scheduleRows.length}{" "}
                            {scheduleRows.length === 1
                                ? "horário registado"
                                : "horários registados"}{" "}
                            no total
                        </p>
                    </div>

                    <NewScheduleDialog
                        defaultMonth={currentMonthValue()}
                        defaultLocationId={defaultLocation?.id ?? null}
                        locations={locationRows}
                    />
                </header>

                <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
                    {scheduleRows.length === 0 ? (
                        <div className="flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                            Ainda não há horários criados
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Mês</TableHead>
                                    <TableHead>Atualizado</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {scheduleRows.map((schedule) => {
                                    return (
                                        <TableRow key={schedule.id}>
                                            <TableCell className="font-medium capitalize">
                                                {formatMonthLabel(schedule.month.slice(0, 7))}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDateTime(
                                                    schedule.updated_at ?? schedule.created_at
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <ScheduleRowActions schedule={schedule} />
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
