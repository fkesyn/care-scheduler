import {
    CalendarDaysIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    LockIcon,
    UnlockIcon,
    XIcon,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import {
    reviewVacationRequest,
    setVacationYearOpen,
    updateVacationAllowance,
} from "@/app/dashboard/vacations/actions";
import { VacationCalendar } from "@/app/dashboard/vacations/vacation-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { canManageData, getCurrentUserRole } from "@/lib/auth/permissions";
import { mergeYearHolidays } from "@/lib/holidays/year-holidays";
import { createClient } from "@/lib/supabase/server";

type VacationsPageProps = {
    searchParams: Promise<{ year?: string }>;
};

type Employee = {
    id: string;
    name: string;
    email: string | null;
};

type VacationRequest = {
    id: string;
    employee_id: string;
    status: "pending" | "approved" | "rejected";
    reviewed_by_name: string | null;
    rejection_reason: string | null;
    created_at: string;
};

type VacationDay = {
    request_id: string;
    vacation_date: string;
};

type Allowance = {
    employee_id: string;
    total_days: number;
};

type MyBalance = {
    employee_id: string;
    total_days: number;
    approved_days: number;
    pending_days: number;
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
}

function nextBusinessDate(value: string) {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);

    if (date.getUTCDay() === 6) {
        date.setUTCDate(date.getUTCDate() + 2);
    } else if (date.getUTCDay() === 0) {
        date.setUTCDate(date.getUTCDate() + 1);
    }

    return date.toISOString().slice(0, 10);
}

function formatVacationPeriods(values: string[]) {
    const dates = Array.from(new Set(values)).sort();
    const periods: Array<{ start: string; end: string }> = [];

    for (const date of dates) {
        const currentPeriod = periods.at(-1);

        if (currentPeriod && nextBusinessDate(currentPeriod.end) === date) {
            currentPeriod.end = date;
        } else {
            periods.push({ start: date, end: date });
        }
    }

    return periods
        .map((period) =>
            period.start === period.end
                ? formatDate(period.start)
                : `${formatDate(period.start)} a ${formatDate(period.end)}`
        )
        .join(" · ");
}

function vacationStatusLabel(status: VacationRequest["status"]) {
    if (status === "approved") {
        return "Aprovado";
    }

    if (status === "rejected") {
        return "Rejeitado";
    }

    return "Pendente";
}

export default async function VacationsPage({ searchParams }: VacationsPageProps) {
    await connection();

    const params = await searchParams;
    const parsedYear = Number(params.year);
    const year = Number.isInteger(parsedYear) && parsedYear >= 2027 ? parsedYear : 2027;
    const role = await getCurrentUserRole();
    const isAdmin = canManageData(role);
    const supabase = await createClient();

    const [
        { data: employeesData, error: employeesError },
        { data: settingsData, error: settingsError },
        { data: requestsData, error: requestsError },
        { data: daysData, error: daysError },
        { data: allowancesData, error: allowancesError },
        { data: balanceData, error: balanceError },
        { data: holidaysData, error: holidaysError },
    ] = await Promise.all([
        supabase
            .from("employees")
            .select("id, name, email")
            .eq("active", true)
            .order("name"),
        supabase
            .from("vacation_year_settings")
            .select("year, is_open")
            .eq("year", year)
            .maybeSingle(),
        supabase
            .from("vacation_requests")
            .select(
                "id, employee_id, status, reviewed_by_name, rejection_reason, created_at"
            )
            .eq("year", year)
            .order("created_at"),
        supabase
            .from("vacation_request_days")
            .select("request_id, vacation_date")
            .gte("vacation_date", `${year}-01-01`)
            .lte("vacation_date", `${year}-12-31`)
            .order("vacation_date"),
        supabase
            .from("employee_vacation_allowances")
            .select("employee_id, total_days")
            .eq("year", year),
        supabase.rpc("my_vacation_balance", { p_year: year }),
        supabase
            .from("public_holidays")
            .select("holiday_date, name, country_code, region")
            .eq("country_code", "PT")
            .gte("holiday_date", `${year}-01-01`)
            .lte("holiday_date", `${year}-12-31`),
    ]);

    const loadError =
        employeesError ??
        settingsError ??
        requestsError ??
        daysError ??
        allowancesError ??
        balanceError ??
        holidaysError;

    if (loadError) {
        return (
            <div className="p-6">
                <div className="mx-auto max-w-6xl rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
                    Não consegui carregar as férias: {loadError.message}. Confirma que a
                    migração <code>20261116100000_employee_vacations.sql</code> foi aplicada.
                </div>
            </div>
        );
    }

    const employees = (employeesData ?? []) as Employee[];
    const requests = (requestsData ?? []) as VacationRequest[];
    const days = (daysData ?? []) as VacationDay[];
    const allowances = (allowancesData ?? []) as Allowance[];
    const myBalance = ((balanceData ?? [])[0] ?? null) as MyBalance | null;
    const holidays = mergeYearHolidays(year, holidaysData ?? []).map((holiday) => ({
        date: holiday.holiday_date,
        name: holiday.name,
    }));
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const requestById = new Map(requests.map((request) => [request.id, request]));
    const daysByRequest = new Map<string, string[]>();

    for (const day of days) {
        const requestDays = daysByRequest.get(day.request_id) ?? [];
        requestDays.push(day.vacation_date);
        daysByRequest.set(day.request_id, requestDays);
    }

    const approvedDays = days.flatMap((day) => {
        const request = requestById.get(day.request_id);
        const employee = request ? employeeById.get(request.employee_id) : null;

        if (!request || request.status !== "approved" || !employee) {
            return [];
        }

        return [
            {
                date: day.vacation_date,
                employeeName: employee.name,
                approvedBy: request.reviewed_by_name ?? "Administrador",
            },
        ];
    });
    const isOpen = settingsData?.is_open ?? year === 2027;
    const totalDays = Number(myBalance?.total_days ?? 22);
    const approvedCount = Number(myBalance?.approved_days ?? 0);
    const pendingCount = Number(myBalance?.pending_days ?? 0);
    const remainingDays = Math.max(0, totalDays - approvedCount - pendingCount);
    const pendingRequests = requests.filter((request) => request.status === "pending");
    const myRequests = myBalance
        ? requests
              .filter((request) => request.employee_id === myBalance.employee_id)
              .sort((first, second) => second.created_at.localeCompare(first.created_at))
        : [];
    const allowanceByEmployee = new Map(
        allowances.map((allowance) => [allowance.employee_id, allowance.total_days])
    );
    const approvedCountByEmployee = new Map<string, number>();

    for (const request of requests) {
        if (request.status !== "approved") {
            continue;
        }

        approvedCountByEmployee.set(
            request.employee_id,
            (approvedCountByEmployee.get(request.employee_id) ?? 0) +
                (daysByRequest.get(request.id)?.length ?? 0)
        );
    }

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <CalendarDaysIcon className="size-6" />
                            <h1 className="text-2xl font-semibold tracking-tight">Férias</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Consulta as férias aprovadas e seleciona dias úteis para pedir.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="icon-sm">
                            <Link
                                href={`/dashboard/vacations?year=${Math.max(2027, year - 1)}`}
                                aria-label="Ano anterior"
                            >
                                <ChevronLeftIcon />
                            </Link>
                        </Button>
                        <div className="min-w-24 text-center text-xl font-semibold">{year}</div>
                        <Button asChild variant="outline" size="icon-sm">
                            <Link
                                href={`/dashboard/vacations?year=${year + 1}`}
                                aria-label="Ano seguinte"
                            >
                                <ChevronRightIcon />
                            </Link>
                        </Button>
                    </div>
                </header>

                {myBalance ? (
                    <section className="grid gap-4 sm:grid-cols-3">
                        <Card size="sm">
                            <CardHeader>
                                <CardDescription>Direito anual</CardDescription>
                                <CardTitle className="text-2xl">{totalDays} dias úteis</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card size="sm">
                            <CardHeader>
                                <CardDescription>Marcados e aprovados</CardDescription>
                                <CardTitle className="text-2xl">{approvedCount}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card size="sm">
                            <CardHeader>
                                <CardDescription>
                                    Ainda por marcar{pendingCount ? ` · ${pendingCount} pendentes` : ""}
                                </CardDescription>
                                <CardTitle className="text-2xl">{remainingDays}</CardTitle>
                            </CardHeader>
                        </Card>
                    </section>
                ) : (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        O teu login não está associado a um funcionário ativo com o mesmo
                        email. Podes consultar o calendário, mas não submeter pedidos.
                    </div>
                )}

                {myBalance ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Os meus pedidos de {year}</CardTitle>
                            <CardDescription>
                                Consulta os períodos submetidos e o respetivo estado.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {myRequests.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Ainda não submeteste pedidos para {year}.
                                </p>
                            ) : (
                                myRequests.map((request) => {
                                    const requestDays = daysByRequest.get(request.id) ?? [];

                                    return (
                                        <div
                                            key={request.id}
                                            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {formatVacationPeriods(requestDays)}
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {requestDays.length}{" "}
                                                    {requestDays.length === 1
                                                        ? "dia útil"
                                                        : "dias úteis"}
                                                    {request.status === "approved" &&
                                                    request.reviewed_by_name
                                                        ? ` · aprovado por ${request.reviewed_by_name}`
                                                        : ""}
                                                </p>
                                                {request.status === "rejected" &&
                                                request.rejection_reason ? (
                                                    <p className="mt-2 text-sm text-destructive">
                                                        Motivo: {request.rejection_reason}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <Badge
                                                variant={
                                                    request.status === "approved"
                                                        ? "secondary"
                                                        : request.status === "rejected"
                                                          ? "destructive"
                                                          : "outline"
                                                }
                                            >
                                                {vacationStatusLabel(request.status)}
                                            </Badge>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                ) : null}

                {isAdmin ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuração administrativa de {year}</CardTitle>
                            <CardDescription>
                                Abre ou bloqueia o ano e ajusta o saldo individual. O mínimo é
                                22 dias, sem limite máximo para permitir transportar dias não
                                gozados.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5">
                            <form action={setVacationYearOpen} className="flex items-center gap-3">
                                <input type="hidden" name="year" value={year} />
                                <input
                                    type="hidden"
                                    name="is_open"
                                    value={isOpen ? "false" : "true"}
                                />
                                <Button type="submit" variant={isOpen ? "outline" : "default"}>
                                    {isOpen ? <LockIcon /> : <UnlockIcon />}
                                    {isOpen ? "Bloquear ano" : "Desbloquear ano"}
                                </Button>
                                <Badge variant={isOpen ? "secondary" : "outline"}>
                                    {isOpen ? "Aberto para pedidos" : "Bloqueado"}
                                </Badge>
                            </form>

                            <div className="overflow-x-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Funcionário</TableHead>
                                            <TableHead>Aprovados</TableHead>
                                            <TableHead>Saldo anual</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employees.map((employee) => (
                                            <TableRow key={employee.id}>
                                                <TableCell className="font-medium">
                                                    {employee.name}
                                                </TableCell>
                                                <TableCell>
                                                    {approvedCountByEmployee.get(employee.id) ?? 0}
                                                </TableCell>
                                                <TableCell>
                                                    <form
                                                        action={updateVacationAllowance}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <input
                                                            type="hidden"
                                                            name="employee_id"
                                                            value={employee.id}
                                                        />
                                                        <input type="hidden" name="year" value={year} />
                                                        <input
                                                            type="number"
                                                            name="total_days"
                                                            defaultValue={String(
                                                                allowanceByEmployee.get(employee.id) ?? 22
                                                            )}
                                                            min={22}
                                                            step={1}
                                                            className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm"
                                                            aria-label={`Saldo anual de ${employee.name}`}
                                                            required
                                                        />
                                                        <Button type="submit" size="sm" variant="outline">
                                                            Guardar
                                                        </Button>
                                                    </form>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {isAdmin ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Pedidos pendentes</CardTitle>
                            <CardDescription>
                                Apenas administradores conseguem consultar e decidir estes
                                pedidos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {pendingRequests.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Não existem pedidos pendentes para {year}.
                                </p>
                            ) : (
                                pendingRequests.map((request) => {
                                    const requestDays = daysByRequest.get(request.id) ?? [];
                                    const employee = employeeById.get(request.employee_id);

                                    return (
                                        <div
                                            key={request.id}
                                            className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {employee?.name ?? "Funcionário"} · {requestDays.length}{" "}
                                                    {requestDays.length === 1 ? "dia" : "dias"}
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {requestDays.map(formatDate).join(", ")}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <form action={reviewVacationRequest}>
                                                    <input
                                                        type="hidden"
                                                        name="request_id"
                                                        value={request.id}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="decision"
                                                        value="approved"
                                                    />
                                                    <Button type="submit" size="sm">
                                                        <CheckIcon /> Aprovar
                                                    </Button>
                                                </form>
                                                <form action={reviewVacationRequest}>
                                                    <input
                                                        type="hidden"
                                                        name="request_id"
                                                        value={request.id}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="decision"
                                                        value="rejected"
                                                    />
                                                    <Button type="submit" size="sm" variant="destructive">
                                                        <XIcon /> Rejeitar
                                                    </Button>
                                                </form>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                ) : null}

                <VacationCalendar
                    approvedDays={approvedDays}
                    canRequest={Boolean(myBalance)}
                    holidays={holidays}
                    isOpen={isOpen}
                    remainingDays={remainingDays}
                    year={year}
                />
            </div>
        </div>
    );
}
