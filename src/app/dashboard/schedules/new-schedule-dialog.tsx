"use client";

import { CalendarPlusIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
    createMonthlySchedule,
    type ScheduleFormState,
} from "@/app/dashboard/schedules/actions";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

type LocationOption = {
    id: string;
    name: string;
};

type NewScheduleDialogProps = {
    defaultMonth: string;
    locations: LocationOption[];
};

const initialState: ScheduleFormState = {
    status: "idle",
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A criar..." : "Criar horário"}
        </Button>
    );
}

export function NewScheduleDialog({
    defaultMonth,
    locations,
}: NewScheduleDialogProps) {
    const [state, formAction] = useActionState(
        createMonthlySchedule,
        initialState
    );
    const { closeDialog, open, setOpen, showFormAgain, visibleState } =
        useActionDialog(state, initialState);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (visibleState.status === "success") {
            formRef.current?.reset();
        }
    }, [visibleState.status]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <CalendarPlusIcon />
                    Novo horário mensal
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Novo horário mensal</DialogTitle>
                    <DialogDescription>
                        Cria um rascunho mensal para a equipa.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleState.message ?? "Horário mensal criado."}
                        </p>
                        <DialogFooter className="flex-wrap">
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Criar outro horário
                            </Button>
                            {visibleState.scheduleId ? (
                                <Button asChild variant="secondary">
                                    <Link href={`/dashboard/schedules/${visibleState.scheduleId}`}>
                                        Abrir horário
                                    </Link>
                                </Button>
                            ) : null}
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form ref={formRef} action={formAction} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="schedule-month">Mês</Label>
                            <Input
                                id="schedule-month"
                                name="month"
                                type="month"
                                defaultValue={defaultMonth}
                                aria-invalid={Boolean(visibleState.fieldErrors?.month)}
                                required
                            />
                            {visibleState.fieldErrors?.month ? (
                                <p className="text-sm text-destructive">
                                    {visibleState.fieldErrors.month}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="schedule-location">Local</Label>
                            <select
                                id="schedule-location"
                                name="location_id"
                                defaultValue=""
                                className={cn(
                                    "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                    visibleState.fieldErrors?.locationId &&
                                        "border-destructive ring-3 ring-destructive/20"
                                )}
                                aria-invalid={Boolean(
                                    visibleState.fieldErrors?.locationId
                                )}
                            >
                                <option value="">Geral / todos os locais</option>
                                {locations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                            {visibleState.fieldErrors?.locationId ? (
                                <p className="text-sm text-destructive">
                                    {visibleState.fieldErrors.locationId}
                                </p>
                            ) : null}
                        </div>

                        {visibleState.message ? (
                            <p
                                className={cn(
                                    "text-sm",
                                    visibleState.status === "error"
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                )}
                                role={visibleState.status === "error" ? "alert" : "status"}
                            >
                                {visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancelar
                            </Button>
                            <SubmitButton />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
