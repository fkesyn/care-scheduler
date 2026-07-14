"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    deletePatient,
    type DeletePatientState,
    updatePatient,
    type UpdatePatientState,
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
import {
    ClinicalRecordsDialog,
    type PatientClinicalRecord,
} from "./clinical-records-dialog";
import {
    FamilyContactsDialog,
    type FamilyContact,
} from "./family-contacts-dialog";
import { PatientProfileDropdown } from "./patient-profile-dropdown";

type LocationOption = {
    id: string;
    name: string;
};

type Patient = {
    id: string;
    name: string;
    location_id: string | null;
    birth_date: string | null;
    health_center: string | null;
    family_doctor: string | null;
    patient_number: string | null;
    notes: string | null;
    is_diabetic: boolean | null;
    is_hypertensive: boolean | null;
    has_active_wounds: boolean | null;
    active: boolean | null;
};

type PatientRowActionsProps = {
    canManage: boolean;
    familyContacts: FamilyContact[];
    clinicalRecords: PatientClinicalRecord[];
    patient: Patient;
    locations: LocationOption[];
};

const updateInitialState: UpdatePatientState = {
    status: "idle",
};

const deleteInitialState: DeletePatientState = {
    status: "idle",
};

function SubmitButton({ children }: { children: ReactNode }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : children}
        </Button>
    );
}

function DeleteButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "A apagar..." : "Apagar utente"}
        </Button>
    );
}

export function PatientRowActions({
    canManage,
    familyContacts,
    clinicalRecords,
    patient,
    locations,
}: PatientRowActionsProps) {
    const [updateState, updateAction] = useActionState(
        updatePatient,
        updateInitialState
    );
    const [deleteState, deleteAction] = useActionState(
        deletePatient,
        deleteInitialState
    );
    const updateDialog = useActionDialog(updateState, updateInitialState);
    const deleteDialog = useActionDialog(deleteState, deleteInitialState);

    return (
        <div className="flex flex-col items-end gap-1">
            <FamilyContactsDialog
                canManage={canManage}
                contacts={familyContacts}
                patientId={patient.id}
                patientName={patient.name}
            />
            <ClinicalRecordsDialog
                patientId={patient.id}
                patientName={patient.name}
                records={clinicalRecords}
            />

            {canManage ? (
            <Dialog open={updateDialog.open} onOpenChange={updateDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Editar utente">
                        <PencilIcon />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Editar utente</DialogTitle>
                        <DialogDescription>
                            Atualiza dados, local e estado do utente.
                        </DialogDescription>
                    </DialogHeader>

                    {updateDialog.visibleState.status === "success" ? (
                        <div className="grid gap-4">
                            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                                {updateDialog.visibleState.message}
                            </p>
                            <DialogFooter>
                                <Button type="button" onClick={updateDialog.closeDialog}>
                                    Fechar
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <form action={updateAction} className="grid gap-4">
                            <input type="hidden" name="id" value={patient.id} />

                            <div className="grid gap-2">
                                <Label htmlFor={`patient-name-${patient.id}`}>Nome</Label>
                                <Input
                                    id={`patient-name-${patient.id}`}
                                    name="name"
                                    defaultValue={patient.name}
                                    aria-invalid={Boolean(
                                        updateDialog.visibleState.fieldErrors?.name
                                    )}
                                    required
                                />
                                {updateDialog.visibleState.fieldErrors?.name ? (
                                    <p className="text-sm text-destructive">
                                        {updateDialog.visibleState.fieldErrors.name}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <div className="grid min-w-0 gap-2">
                                    <Label htmlFor={`patient-birth-date-${patient.id}`}>
                                        Data de nascimento
                                    </Label>
                                    <Input
                                        id={`patient-birth-date-${patient.id}`}
                                        name="birth_date"
                                        type="date"
                                        defaultValue={patient.birth_date ?? ""}
                                        aria-invalid={Boolean(
                                            updateDialog.visibleState.fieldErrors
                                                ?.birthDate
                                        )}
                                    />
                                    {updateDialog.visibleState.fieldErrors?.birthDate ? (
                                        <p className="text-sm text-destructive">
                                            {updateDialog.visibleState.fieldErrors.birthDate}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="grid min-w-0 gap-2">
                                    <Label htmlFor={`patient-number-${patient.id}`}>
                                        N.º Utente
                                    </Label>
                                    <Input
                                        id={`patient-number-${patient.id}`}
                                        name="patient_number"
                                        defaultValue={patient.patient_number ?? ""}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <div className="grid min-w-0 gap-2">
                                    <Label htmlFor={`patient-health-center-${patient.id}`}>
                                        Centro de Saúde
                                    </Label>
                                    <Input
                                        id={`patient-health-center-${patient.id}`}
                                        name="health_center"
                                        defaultValue={patient.health_center ?? ""}
                                    />
                                </div>

                                <div className="grid min-w-0 gap-2">
                                    <Label htmlFor={`patient-family-doctor-${patient.id}`}>
                                        Médico de Família
                                    </Label>
                                    <Input
                                        id={`patient-family-doctor-${patient.id}`}
                                        name="family_doctor"
                                        defaultValue={patient.family_doctor ?? ""}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`patient-location-${patient.id}`}>
                                    Local
                                </Label>
                                <select
                                    id={`patient-location-${patient.id}`}
                                    name="location_id"
                                    defaultValue={patient.location_id ?? ""}
                                    className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    aria-invalid={Boolean(
                                        updateDialog.visibleState.fieldErrors
                                            ?.locationId
                                    )}
                                    required
                                >
                                    <option value="" disabled>
                                        Escolher local
                                    </option>
                                    {locations.map((location) => (
                                        <option key={location.id} value={location.id}>
                                            {location.name}
                                        </option>
                                    ))}
                                </select>
                                {updateDialog.visibleState.fieldErrors?.locationId ? (
                                    <p className="text-sm text-destructive">
                                        {
                                            updateDialog.visibleState.fieldErrors
                                                .locationId
                                        }
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`patient-notes-${patient.id}`}>
                                    Notas
                                </Label>
                                <Textarea
                                    id={`patient-notes-${patient.id}`}
                                    name="notes"
                                    defaultValue={patient.notes ?? ""}
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
                                <PatientProfileDropdown
                                    defaultValues={{
                                        hasActiveWounds: patient.has_active_wounds,
                                        isDiabetic: patient.is_diabetic,
                                        isHypertensive: patient.is_hypertensive,
                                    }}
                                />
                                <Label className="flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm leading-tight">
                                    <input
                                        type="checkbox"
                                        name="active"
                                        defaultChecked={Boolean(patient.active)}
                                        className="size-4 shrink-0 rounded border-input accent-foreground"
                                    />
                                    <span className="min-w-0 break-words">Ativo</span>
                                </Label>
                            </div>

                            {updateDialog.visibleState.message ? (
                                <p
                                    className={cn(
                                        "text-sm",
                                        updateDialog.visibleState.status === "error"
                                            ? "text-destructive"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {updateDialog.visibleState.message}
                                </p>
                            ) : null}

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={updateDialog.closeDialog}
                                >
                                    Cancelar
                                </Button>
                                <SubmitButton>Guardar alterações</SubmitButton>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            ) : null}

            {canManage ? (
            <Dialog open={deleteDialog.open} onOpenChange={deleteDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Apagar utente">
                        <Trash2Icon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apagar utente</DialogTitle>
                        <DialogDescription>
                            Esta ação apaga definitivamente este utente.
                        </DialogDescription>
                    </DialogHeader>

                    {deleteDialog.visibleState.status === "success" ? (
                        <div className="grid gap-4">
                            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                                {deleteDialog.visibleState.message}
                            </p>
                            <DialogFooter>
                                <Button type="button" onClick={deleteDialog.closeDialog}>
                                    Fechar
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <form action={deleteAction} className="grid gap-4">
                            <input type="hidden" name="id" value={patient.id} />
                            <p className="text-sm text-muted-foreground">
                                Vais apagar <strong>{patient.name}</strong>. As
                                marcações associadas a este utente também serão apagadas.
                            </p>

                            {deleteDialog.visibleState.message ? (
                                <p className="text-sm text-destructive">
                                    {deleteDialog.visibleState.message}
                                </p>
                            ) : null}

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={deleteDialog.closeDialog}
                                >
                                    Cancelar
                                </Button>
                                <DeleteButton />
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            ) : null}
        </div>
    );
}
