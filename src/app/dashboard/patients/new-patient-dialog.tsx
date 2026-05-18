"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
    createPatient,
    type CreatePatientState,
} from "@/app/dashboard/patients/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";
import { PatientProfileDropdown } from "./patient-profile-dropdown";

type LocationOption = {
    id: string;
    name: string;
};

const initialState: CreatePatientState = {
    status: "idle",
};

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={disabled || pending}>
            {pending ? "A guardar..." : "Criar utente"}
        </Button>
    );
}

export function NewPatientDialog({
    locations,
    selectedLocation,
}: {
    locations: LocationOption[];
    selectedLocation?: string;
}) {
    const [state, formAction] = useActionState(createPatient, initialState);
    const { closeDialog, open, setOpen, showFormAgain, visibleState } =
        useActionDialog(state, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const hasLocations = locations.length > 0;

    useEffect(() => {
        if (visibleState.status === "success") {
            formRef.current?.reset();
        }
    }, [visibleState.status]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={!hasLocations}>
                    <PlusIcon />
                    Novo utente
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Novo utente</DialogTitle>
                    <DialogDescription>
                        Cria um utente e associa-o ao local onde recebe cuidados.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleState.message ?? "Utente criado com sucesso."}
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Criar outro utente
                            </Button>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                <form ref={formRef} action={formAction} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="patient-name">Nome</Label>
                        <Input
                            id="patient-name"
                            name="name"
                            placeholder="Ex.: Maria Silva"
                            aria-describedby={
                                visibleState.fieldErrors?.name
                                    ? "patient-name-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.name)}
                            required
                        />
                        {visibleState.fieldErrors?.name ? (
                            <p id="patient-name-error" className="text-sm text-destructive">
                                {visibleState.fieldErrors.name}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="grid min-w-0 gap-2">
                            <Label htmlFor="patient-birth-date">
                                Data de nascimento
                            </Label>
                            <Input
                                id="patient-birth-date"
                                name="birth_date"
                                type="date"
                                aria-describedby={
                                    visibleState.fieldErrors?.birthDate
                                        ? "patient-birth-date-error"
                                        : undefined
                                }
                                aria-invalid={Boolean(
                                    visibleState.fieldErrors?.birthDate
                                )}
                            />
                            {visibleState.fieldErrors?.birthDate ? (
                                <p
                                    id="patient-birth-date-error"
                                    className="text-sm text-destructive"
                                >
                                    {visibleState.fieldErrors.birthDate}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid min-w-0 gap-2">
                            <Label htmlFor="patient-number">N.º Utente</Label>
                            <Input id="patient-number" name="patient_number" />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="grid min-w-0 gap-2">
                            <Label htmlFor="patient-health-center">
                                Centro de Saúde
                            </Label>
                            <Input id="patient-health-center" name="health_center" />
                        </div>

                        <div className="grid min-w-0 gap-2">
                            <Label htmlFor="patient-family-doctor">
                                Médico de Família
                            </Label>
                            <Input id="patient-family-doctor" name="family_doctor" />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="patient-location">Local</Label>
                        <select
                            id="patient-location"
                            name="location_id"
                            defaultValue={selectedLocation ?? ""}
                            className={cn(
                                "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                visibleState.fieldErrors?.locationId &&
                                    "border-destructive ring-3 ring-destructive/20"
                            )}
                            aria-describedby={
                                visibleState.fieldErrors?.locationId
                                    ? "patient-location-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.locationId)}
                            required
                        >
                            <option value="">Escolher local</option>
                            {locations.map((location) => (
                                <option key={location.id} value={location.id}>
                                    {location.name}
                                </option>
                            ))}
                        </select>
                        {visibleState.fieldErrors?.locationId ? (
                            <p
                                id="patient-location-error"
                                className="text-sm text-destructive"
                            >
                                {visibleState.fieldErrors.locationId}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="patient-notes">Notas</Label>
                        <Textarea
                            id="patient-notes"
                            name="notes"
                            placeholder="Observações relevantes"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
                        <PatientProfileDropdown />
                        <Label className="flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm leading-tight">
                            <input
                                type="checkbox"
                                name="active"
                                defaultChecked
                                className="size-4 shrink-0 rounded border-input accent-foreground"
                            />
                            <span className="min-w-0 break-words">Ativo</span>
                        </Label>
                    </div>

                    {visibleState.message ? (
                        <p
                            className={
                                visibleState.status === "error"
                                    ? "text-sm text-destructive"
                                    : "text-sm text-muted-foreground"
                            }
                            role={visibleState.status === "error" ? "alert" : "status"}
                        >
                            {visibleState.message}
                        </p>
                    ) : null}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeDialog}>
                            Cancelar
                        </Button>
                        <SubmitButton disabled={!hasLocations} />
                    </DialogFooter>
                </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
