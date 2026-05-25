"use client";

import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
    setScheduleGenerationWarningResolved,
    type UpdateGenerationWarningState,
} from "@/app/dashboard/schedules/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Relation<T> = T | T[] | null;

type GenerationWarningRow = {
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

type GenerationWarningsSectionProps = {
    warnings: GenerationWarningRow[];
};

const initialState: UpdateGenerationWarningState = {
    status: "idle",
};

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function formatWarningDate(dateValue: string) {
    return new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "short",
    }).format(new Date(`${dateValue}T00:00:00`));
}

function ResolveButton({ resolved }: { resolved: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" size="sm" variant={resolved ? "outline" : "secondary"}>
            {pending
                ? "A atualizar..."
                : resolved
                  ? "Marcar por resolver"
                  : "Marcar resolvido"}
        </Button>
    );
}

function WarningRow({ warning }: { warning: GenerationWarningRow }) {
    const [state, action] = useActionState(
        setScheduleGenerationWarningResolved,
        initialState
    );
    const shiftType = firstRelation(warning.shift_types);
    const employee = firstRelation(warning.employees);

    return (
        <div
            className={[
                "flex flex-col gap-2 rounded-md border bg-background/80 px-3 py-2",
                warning.resolved ? "opacity-70" : "",
            ].join(" ")}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 font-medium text-amber-900 dark:text-amber-100">
                    {formatWarningDate(warning.work_date)}
                </span>
                {employee ? <Badge variant="outline">{employee.name}</Badge> : null}
                {shiftType ? (
                    <Badge className="font-mono" variant="outline">
                        {shiftType.code}
                    </Badge>
                ) : null}
                <Badge variant={warning.resolved ? "secondary" : "outline"}>
                    {warning.resolved ? "Resolvido" : "Por resolver"}
                </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{warning.message}</p>
            <div className="flex items-center justify-between gap-2">
                <form action={action}>
                    <input type="hidden" name="warning_id" value={warning.id} />
                    <input type="hidden" name="schedule_id" value={warning.schedule_id} />
                    <input
                        type="hidden"
                        name="resolved"
                        value={warning.resolved ? "false" : "true"}
                    />
                    <ResolveButton resolved={warning.resolved} />
                </form>
                {state.status === "error" && state.message ? (
                    <p className="text-xs text-destructive">{state.message}</p>
                ) : null}
            </div>
        </div>
    );
}

export function GenerationWarningsSection({ warnings }: GenerationWarningsSectionProps) {
    const [showResolved, setShowResolved] = useState(false);
    const unresolvedCount = useMemo(
        () => warnings.filter((warning) => !warning.resolved).length,
        [warnings]
    );
    const visibleWarnings = useMemo(
        () =>
            warnings.filter((warning) => (showResolved ? true : !warning.resolved)),
        [warnings, showResolved]
    );

    if (warnings.length === 0) {
        return null;
    }

    return (
        <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm shadow-xs dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h2 className="flex items-center gap-2 font-medium text-amber-950 dark:text-amber-100">
                        <AlertTriangleIcon className="size-4" />
                        Avisos do rascunho
                    </h2>
                    <p className="text-xs text-amber-800 dark:text-amber-200/80">
                        {unresolvedCount} por resolver. Revê estes pontos antes de publicar.
                    </p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowResolved((current) => !current)}
                >
                    <CheckCircle2Icon />
                    {showResolved ? "Ocultar resolvidos" : "Mostrar resolvidos"}
                </Button>
            </div>

            {visibleWarnings.length === 0 ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                    Não há avisos para mostrar com o filtro atual.
                </p>
            ) : (
                <div className="grid gap-2">
                    {visibleWarnings.map((warning) => (
                        <WarningRow key={warning.id} warning={warning} />
                    ))}
                </div>
            )}
        </section>
    );
}
