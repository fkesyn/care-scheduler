"use client";

import { CalendarPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
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
    defaultLocationId: string | null;
    locations: LocationOption[];
};

const ENABLE_LOCATION_SELECTION = false;

const initialState: ScheduleFormState = {
    status: "idle",
};

function shiftMonth(monthValue: string, offset: number) {
    if (!/^\d{4}-\d{2}$/.test(monthValue)) {
        return monthValue;
    }

    const [year, month] = monthValue.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + offset);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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
    defaultLocationId,
    locations,
}: NewScheduleDialogProps) {
    const router = useRouter();
    const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
    const [state, formAction] = useActionState(
        createMonthlySchedule,
        initialState
    );
    const { closeDialog, open, setOpen, visibleState } = useActionDialog(
        state,
        initialState
    );
    const formRef = useRef<HTMLFormElement>(null);
    const monthInputRef = useRef<HTMLInputElement>(null);

    function openMonthPicker() {
        const input = monthInputRef.current;
        if (!input) {
            return;
        }

        const pickerInput = input as HTMLInputElement & {
            showPicker?: () => void;
        };

        if (typeof pickerInput.showPicker === "function") {
            pickerInput.showPicker();
            return;
        }

        input.focus();
        input.click();
    }

    useEffect(() => {
        if (visibleState.status === "success") {
            if (visibleState.scheduleId) {
                setOpen(false);
                router.push(`/dashboard/schedules/${visibleState.scheduleId}`);
                return;
            }

            formRef.current?.reset();
        }
    }, [router, setOpen, visibleState.scheduleId, visibleState.status]);

    useEffect(() => {
        if (!open) {
            setSelectedMonth(defaultMonth);
        }
    }, [defaultMonth, open]);

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
                        Cria um horário mensal para a equipa.
                    </DialogDescription>
                </DialogHeader>

                <form ref={formRef} action={formAction} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="schedule-month">Mês</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setSelectedMonth((current) => shiftMonth(current, -1))
                                }
                                aria-label="Mês anterior"
                            >
                                ←
                            </Button>
                            <Input
                                id="schedule-month"
                                name="month"
                                type="month"
                                ref={monthInputRef}
                                value={selectedMonth}
                                onChange={(event) =>
                                    setSelectedMonth(event.target.value)
                                }
                                onClick={openMonthPicker}
                                lang="pt-PT"
                                aria-invalid={Boolean(visibleState.fieldErrors?.month)}
                                required
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setSelectedMonth((current) => shiftMonth(current, 1))
                                }
                                aria-label="Mês seguinte"
                            >
                                →
                            </Button>
                        </div>
                        {visibleState.fieldErrors?.month ? (
                            <p className="text-sm text-destructive">
                                {visibleState.fieldErrors.month}
                            </p>
                        ) : null}
                    </div>

                    {/* Keep location selection code ready for future reactivation. */}
                    {ENABLE_LOCATION_SELECTION ? (
                        <div className="grid gap-2">
                            <Label htmlFor="schedule-location">Local</Label>
                            <select
                                id="schedule-location"
                                name="location_id"
                                defaultValue={defaultLocationId ?? ""}
                                className={cn(
                                    "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                    visibleState.fieldErrors?.locationId &&
                                        "border-destructive ring-3 ring-destructive/20"
                                )}
                                aria-invalid={Boolean(visibleState.fieldErrors?.locationId)}
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
                    ) : (
                        <>
                            <input
                                type="hidden"
                                name="location_id"
                                value={defaultLocationId ?? ""}
                            />
                            <p className="text-xs text-muted-foreground">
                                Local aplicado automaticamente: São Francisco.
                            </p>
                        </>
                    )}

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
            </DialogContent>
        </Dialog>
    );
}
