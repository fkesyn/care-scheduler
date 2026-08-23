"use client";

import { ClipboardCheckIcon, Trash2Icon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    clearScheduleWarnings,
    validateScheduleWarnings,
    type ClearScheduleWarningsState,
    type ValidateScheduleWarningsState,
} from "@/app/dashboard/schedules/actions";
import { Button } from "@/components/ui/button";

type ScheduleWarningsActionsProps = {
    canManage: boolean;
    scheduleId: string;
    warningsCount: number;
};

const initialValidateState: ValidateScheduleWarningsState = {
    status: "idle",
};

const initialClearState: ClearScheduleWarningsState = {
    status: "idle",
};

function ValidateButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            <ClipboardCheckIcon />
            {pending ? "A validar..." : "Validar horário"}
        </Button>
    );
}

function ClearButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="outline" disabled={disabled || pending}>
            <Trash2Icon />
            {pending ? "A limpar..." : "Limpar avisos"}
        </Button>
    );
}

export function ScheduleWarningsActions({
    canManage,
    scheduleId,
    warningsCount,
}: ScheduleWarningsActionsProps) {
    const [validateState, validateAction] = useActionState(
        validateScheduleWarnings,
        initialValidateState
    );
    const [clearState, clearAction] = useActionState(
        clearScheduleWarnings,
        initialClearState
    );

    if (!canManage) {
        return null;
    }

    return (
        <section className="rounded-lg border bg-card p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-1">
                    <h2 className="text-sm font-medium">Validação do horário</h2>
                    <p className="text-xs text-muted-foreground">
                        {warningsCount === 0
                            ? "Sem avisos guardados neste momento."
                            : `${warningsCount} ${
                                  warningsCount === 1
                                      ? "aviso guardado"
                                      : "avisos guardados"
                              } da última validação.`}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <form action={validateAction}>
                        <input type="hidden" name="schedule_id" value={scheduleId} />
                        <ValidateButton />
                    </form>
                    <form action={clearAction}>
                        <input type="hidden" name="schedule_id" value={scheduleId} />
                        <ClearButton disabled={warningsCount === 0} />
                    </form>
                </div>
            </div>

            <div className="mt-3 grid gap-2">
                {[validateState, clearState].map((state, index) =>
                    state.status !== "idle" && state.message ? (
                        <p
                            key={index}
                            className={[
                                "rounded-md border px-3 py-2 text-sm",
                                state.status === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                                    : "border-destructive/30 bg-destructive/10 text-destructive",
                            ].join(" ")}
                            role="status"
                        >
                            {state.message}
                        </p>
                    ) : null
                )}
            </div>
        </section>
    );
}
