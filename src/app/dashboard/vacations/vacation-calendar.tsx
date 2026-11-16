"use client";

import { CalendarCheckIcon, LockIcon, SendIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
    submitVacationRequest,
    type VacationActionState,
} from "@/app/dashboard/vacations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ApprovedVacationDay = {
    date: string;
    employeeName: string;
    approvedBy: string;
};

type CalendarHoliday = {
    date: string;
    name: string;
};

type VacationCalendarProps = {
    approvedDays: ApprovedVacationDay[];
    canRequest: boolean;
    holidays: CalendarHoliday[];
    isOpen: boolean;
    remainingDays: number;
    year: number;
};

const initialState: VacationActionState = { status: "idle" };
const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
];
const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dateValue(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
    )}`;
}

function SubmitButton({ disabled, count }: { disabled: boolean; count: number }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={disabled || pending}>
            {pending ? <Spinner /> : <SendIcon />}
            {pending
                ? "A submeter..."
                : `Submeter pedido (${count} ${count === 1 ? "dia" : "dias"})`}
        </Button>
    );
}

export function VacationCalendar({
    approvedDays,
    canRequest,
    holidays,
    isOpen,
    remainingDays,
    year,
}: VacationCalendarProps) {
    const [state, formAction] = useActionState(submitVacationRequest, initialState);
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    const today = new Date();
    const todayValue = dateValue(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );
    const approvedByDate = useMemo(
        () => new Map(approvedDays.map((entry) => [entry.date, entry])),
        [approvedDays]
    );
    const holidayByDate = useMemo(
        () => new Map(holidays.map((holiday) => [holiday.date, holiday])),
        [holidays]
    );

    useEffect(() => {
        if (state.status === "success") {
            const timeoutId = window.setTimeout(() => {
                setSelectedDates(new Set());
            }, 0);

            return () => window.clearTimeout(timeoutId);
        }
    }, [state]);

    function toggleDate(value: string) {
        setSelectedDates((current) => {
            const next = new Set(current);

            if (next.has(value)) {
                next.delete(value);
            } else if (next.size < remainingDays) {
                next.add(value);
            }

            return next;
        });
    }

    return (
        <form action={formAction} className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-sm">
                <div className="flex items-center gap-2">
                    <span className="size-3 rounded-sm border bg-primary/15" />
                    Selecionado
                </div>
                <div className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-amber-200 ring-1 ring-amber-400 dark:bg-amber-950" />
                    Férias aprovadas
                </div>
                <div className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-rose-100 ring-1 ring-rose-300 dark:bg-rose-950" />
                    Feriado
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-3 rounded-sm bg-muted" />
                    Fim de semana
                </div>
                {!isOpen ? (
                    <Badge variant="outline" className="ml-auto">
                        <LockIcon /> Ano bloqueado
                    </Badge>
                ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {monthNames.map((monthName, monthIndex) => {
                    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                    const firstDay = new Date(year, monthIndex, 1).getDay();
                    const mondayOffset = (firstDay + 6) % 7;

                    return (
                        <section
                            key={monthName}
                            className="rounded-xl border bg-card p-4 shadow-xs"
                        >
                            <h2 className="mb-3 font-semibold">{monthName}</h2>
                            <div className="grid grid-cols-7 gap-1 text-center">
                                {weekdayLabels.map((weekday) => (
                                    <div
                                        key={weekday}
                                        className="pb-1 text-[11px] font-medium text-muted-foreground"
                                    >
                                        {weekday}
                                    </div>
                                ))}
                                {Array.from({ length: mondayOffset }, (_, index) => (
                                    <span key={`empty-${index}`} />
                                ))}
                                {Array.from({ length: daysInMonth }, (_, index) => {
                                    const day = index + 1;
                                    const value = dateValue(year, monthIndex, day);
                                    const weekday = new Date(year, monthIndex, day).getDay();
                                    const weekend = weekday === 0 || weekday === 6;
                                    const approved = approvedByDate.get(value);
                                    const holiday = holidayByDate.get(value);
                                    const selected = selectedDates.has(value);
                                    const past = value < todayValue;
                                    const disabled =
                                        weekend ||
                                        past ||
                                        Boolean(holiday) ||
                                        Boolean(approved) ||
                                        !isOpen ||
                                        !canRequest;

                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => toggleDate(value)}
                                            title={
                                                approved
                                                    ? `${approved.employeeName} · aprovado por ${approved.approvedBy}`
                                                    : holiday
                                                      ? holiday.name
                                                    : weekend
                                                      ? "Fim de semana"
                                                      : past
                                                        ? "Data passada"
                                                      : undefined
                                            }
                                            className={cn(
                                                "relative flex min-h-12 flex-col items-center justify-center rounded-md border border-transparent text-xs transition",
                                                weekend &&
                                                    "cursor-not-allowed bg-muted/60 text-muted-foreground",
                                                !disabled &&
                                                    "hover:border-primary/40 hover:bg-primary/5",
                                                selected &&
                                                    "border-primary bg-primary/15 font-semibold text-primary",
                                                approved &&
                                                    "cursor-not-allowed border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
                                                holiday &&
                                                    "cursor-not-allowed border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100"
                                            )}
                                        >
                                            <span>{day}</span>
                                            {approved ? (
                                                <>
                                                    <span className="max-w-full truncate px-0.5 text-[8px] leading-tight">
                                                        {approved.employeeName.split(" ")[0]}
                                                    </span>
                                                    <span className="max-w-full truncate px-0.5 text-[7px] leading-tight opacity-75">
                                                        por {approved.approvedBy.split(" ")[0]}
                                                    </span>
                                                </>
                                            ) : null}
                                            {holiday ? (
                                                <span className="max-w-full truncate px-0.5 text-[7px] leading-tight">
                                                    {holiday.name}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>

            {Array.from(selectedDates).map((date) => (
                <input key={date} type="hidden" name="vacation_dates" value={date} />
            ))}

            <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-medium">
                        {selectedDates.size} de {remainingDays} dias disponíveis selecionados
                    </p>
                    <p className="text-xs text-muted-foreground">
                        O pedido fica pendente até aprovação de um administrador.
                    </p>
                </div>
                <SubmitButton
                    count={selectedDates.size}
                    disabled={
                        !canRequest ||
                        !isOpen ||
                        selectedDates.size === 0 ||
                        selectedDates.size > remainingDays
                    }
                />
            </div>

            {state.message ? (
                <div
                    className={cn(
                        "rounded-md border p-3 text-sm",
                        state.status === "error"
                            ? "border-destructive/30 bg-destructive/5 text-destructive"
                            : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                    )}
                    role={state.status === "error" ? "alert" : "status"}
                >
                    {state.status === "success" ? (
                        <CalendarCheckIcon className="mr-2 inline size-4" />
                    ) : null}
                    {state.message}
                </div>
            ) : null}
        </form>
    );
}
