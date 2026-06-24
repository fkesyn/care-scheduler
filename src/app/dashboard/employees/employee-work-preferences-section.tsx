"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
    createEmployeeWorkPreference,
    deleteEmployeeWorkPreference,
    updateEmployeeWorkPreference,
    type DeleteWorkPreferenceState,
    type WorkPreferenceFormState,
} from "@/app/dashboard/employees/actions";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

type WorkPreference = {
    id: string;
    employee_id: string;
    preference_type: string;
    shift_type_id: string | null;
    weekday: number | null;
    active: boolean | null;
    notes: string | null;
};

type ShiftType = {
    id: string;
    code: string;
    name: string;
    active: boolean | null;
};

type EmployeeWorkPreferencesSectionProps = {
    employeeId: string;
    preferences: WorkPreference[];
    shiftTypes: ShiftType[];
};

type GroupedWorkPreference = {
    key: string;
    preferenceIds: string[];
    preferences: WorkPreference[];
    representative: WorkPreference;
    weekdays: number[] | null;
};

const initialFormState: WorkPreferenceFormState = {
    status: "idle",
};

const initialDeleteState: DeleteWorkPreferenceState = {
    status: "idle",
};

const preferenceTypeOptions = [
    { value: "preferred_shift", label: "Prefere turno" },
    { value: "avoid_shift", label: "Evitar turno" },
    { value: "only_shift", label: "Só este turno" },
    { value: "preferred_day_off", label: "Prefere folga" },
    { value: "unavailable_weekday", label: "Indisponível no dia da semana" },
    { value: "max_shifts_per_week", label: "Máximo de turnos por semana" },
];

const weekdayOptions = [
    { value: "1", label: "Segunda-feira" },
    { value: "2", label: "Terça-feira" },
    { value: "3", label: "Quarta-feira" },
    { value: "4", label: "Quinta-feira" },
    { value: "5", label: "Sexta-feira" },
    { value: "6", label: "Sábado" },
    { value: "0", label: "Domingo" },
];

function preferenceTypeLabel(value: string) {
    return (
        preferenceTypeOptions.find((option) => option.value === value)?.label ?? value
    );
}

function weekdayLabel(value: number | null) {
    if (value === null) {
        return "Todos os dias";
    }

    return (
        weekdayOptions.find((option) => Number(option.value) === value)?.label ??
        `Dia ${value}`
    );
}

function groupedWeekdayLabel(weekdays: number[] | null) {
    if (weekdays === null || weekdays.length === 0) {
        return "Todos os dias";
    }

    return weekdays.map((weekday) => weekdayLabel(weekday)).join(", ");
}

function shiftTypeLabel(shiftTypeId: string | null, shiftTypes: ShiftType[]) {
    if (!shiftTypeId) {
        return "Sem turno";
    }

    const shiftType = shiftTypes.find((item) => item.id === shiftTypeId);

    if (!shiftType) {
        return "Turno removido";
    }

    return `${shiftType.code} - ${shiftType.name}`;
}

function SaveButton({ label }: { label: string }) {
    const { pending } = useFormStatus();

    return <Button type="submit" disabled={pending}>{pending ? "A guardar..." : label}</Button>;
}

function DeleteButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "A apagar..." : "Apagar preferência"}
        </Button>
    );
}

function WorkPreferenceFormFields({
    employeeId,
    fieldErrors,
    preference,
    selectedWeekdays,
    shiftTypes,
}: {
    employeeId: string;
    fieldErrors?: WorkPreferenceFormState["fieldErrors"];
    preference?: WorkPreference;
    selectedWeekdays?: number[] | null;
    shiftTypes: ShiftType[];
}) {
    const [selectedPreferenceType, setSelectedPreferenceType] = useState(
        preference?.preference_type ?? "preferred_shift"
    );
    const isShiftNotApplicable =
        selectedPreferenceType === "max_shifts_per_week" ||
        selectedPreferenceType === "preferred_day_off" ||
        selectedPreferenceType === "unavailable_weekday";

    return (
        <>
            <input type="hidden" name="employee_id" value={employeeId} />

            <div className="grid gap-2">
                <Label htmlFor={`preference-type-${preference?.id ?? "new"}`}>
                    Tipo de preferência
                </Label>
                <select
                    id={`preference-type-${preference?.id ?? "new"}`}
                    name="preference_type"
                    defaultValue={selectedPreferenceType}
                    onChange={(event) => setSelectedPreferenceType(event.target.value)}
                    className={cn(
                        "h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        fieldErrors?.preferenceType && "border-destructive"
                    )}
                    aria-invalid={Boolean(fieldErrors?.preferenceType)}
                    required
                >
                    {preferenceTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {fieldErrors?.preferenceType ? (
                    <p className="text-sm text-destructive">{fieldErrors.preferenceType}</p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`preference-shift-${preference?.id ?? "new"}`}>
                    Turno (quando aplicável)
                </Label>
                <select
                    id={`preference-shift-${preference?.id ?? "new"}`}
                    name="shift_type_id"
                    defaultValue={preference?.shift_type_id ?? ""}
                    disabled={isShiftNotApplicable}
                    className={cn(
                        "h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                        fieldErrors?.shiftTypeId && "border-destructive"
                    )}
                    aria-invalid={Boolean(fieldErrors?.shiftTypeId)}
                >
                    <option value="">
                        {isShiftNotApplicable
                            ? "Não aplicável"
                            : "Escolher turno"}
                    </option>
                    {shiftTypes.map((shiftType) => (
                        <option key={shiftType.id} value={shiftType.id}>
                            {shiftType.code} - {shiftType.name}
                        </option>
                    ))}
                </select>
                {fieldErrors?.shiftTypeId ? (
                    <p className="text-sm text-destructive">{fieldErrors.shiftTypeId}</p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <Label>Dias da semana (opcional)</Label>
                <details
                    className={cn(
                        "group rounded-md border border-input bg-background px-3 py-2 text-sm",
                        fieldErrors?.weekday && "border-destructive"
                    )}
                >
                    <summary className="cursor-pointer list-none select-none font-medium">
                        Selecionar dias da semana
                    </summary>
                    <div className="mt-3 grid gap-2 border-t pt-3">
                        <Label className="flex items-center gap-2 text-sm font-normal">
                            <input
                                type="checkbox"
                                name="weekday_values"
                                value="all"
                                defaultChecked={
                                    selectedWeekdays === null ||
                                    (selectedWeekdays === undefined &&
                                        (preference?.weekday === null ||
                                            preference?.weekday === undefined))
                                }
                                className="size-4 rounded border-input accent-foreground"
                            />
                            Todos os dias
                        </Label>
                        <div className="grid gap-1 sm:grid-cols-2">
                            {weekdayOptions.map((option) => (
                                <Label
                                    key={option.value}
                                    className="flex items-center gap-2 text-sm font-normal"
                                >
                                    <input
                                        type="checkbox"
                                        name="weekday_values"
                                        value={option.value}
                                        defaultChecked={
                                            selectedWeekdays
                                                ? selectedWeekdays.includes(
                                                      Number(option.value)
                                                  )
                                                : preference?.weekday !== null &&
                                                  preference?.weekday !== undefined &&
                                                  String(preference.weekday) === option.value
                                        }
                                        className="size-4 rounded border-input accent-foreground"
                                    />
                                    {option.label}
                                </Label>
                            ))}
                        </div>
                    </div>
                </details>
                {fieldErrors?.weekday ? (
                    <p className="text-sm text-destructive">{fieldErrors.weekday}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                    Se escolheres dias específicos, &quot;Todos os dias&quot; é ignorado.
                </p>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`preference-notes-${preference?.id ?? "new"}`}>
                    Notas
                </Label>
                <Textarea
                    id={`preference-notes-${preference?.id ?? "new"}`}
                    name="notes"
                    defaultValue={preference?.notes ?? ""}
                    placeholder={
                        selectedPreferenceType === "max_shifts_per_week"
                            ? "Ex: máximo 4 por semana"
                            : "Ex: Prefere tardes"
                    }
                />
                <p className="text-xs text-muted-foreground">
                    Para &quot;Máximo de turnos por semana&quot;, inclui um número nas
                    notas (ex: &quot;4 por semana&quot;).
                </p>
            </div>

            <Label className="flex h-9 items-center gap-2 rounded-md border px-3">
                <input
                    type="checkbox"
                    name="active"
                    defaultChecked={preference ? Boolean(preference.active) : true}
                    className="size-4 rounded border-input accent-foreground"
                />
                Preferência ativa
            </Label>
        </>
    );
}

function NewWorkPreferenceDialog({
    employeeId,
    shiftTypes,
}: {
    employeeId: string;
    shiftTypes: ShiftType[];
}) {
    const [state, action] = useActionState(
        createEmployeeWorkPreference,
        initialFormState
    );
    const dialog = useActionDialog(state, initialFormState);

    return (
        <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <PlusIcon />
                    Adicionar preferência
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova preferência fixa</DialogTitle>
                    <DialogDescription>
                        Define regras permanentes para o gerador de rascunho.
                    </DialogDescription>
                </DialogHeader>

                {dialog.visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                            {dialog.visibleState.message}
                        </p>
                        <DialogFooter>
                            <Button type="button" onClick={dialog.closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form action={action} className="grid gap-4">
                        <WorkPreferenceFormFields
                            employeeId={employeeId}
                            fieldErrors={dialog.visibleState.fieldErrors}
                            shiftTypes={shiftTypes}
                        />

                        {dialog.visibleState.message ? (
                            <p className="text-sm text-destructive">
                                {dialog.visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={dialog.closeDialog}
                            >
                                Cancelar
                            </Button>
                            <SaveButton label="Guardar preferência" />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

function WorkPreferenceRowActions({
    employeeId,
    groupedWeekdays,
    preference,
    preferenceIds,
    shiftTypes,
}: {
    employeeId: string;
    groupedWeekdays: number[] | null;
    preference: WorkPreference;
    preferenceIds: string[];
    shiftTypes: ShiftType[];
}) {
    const [updateState, updateAction] = useActionState(
        updateEmployeeWorkPreference,
        initialFormState
    );
    const [deleteState, deleteAction] = useActionState(
        deleteEmployeeWorkPreference,
        initialDeleteState
    );
    const updateDialog = useActionDialog(updateState, initialFormState);
    const deleteDialog = useActionDialog(deleteState, initialDeleteState);

    return (
        <div className="flex items-center gap-1">
            <Dialog open={updateDialog.open} onOpenChange={updateDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Editar preferência">
                        <PencilIcon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar preferência fixa</DialogTitle>
                        <DialogDescription>
                            Podes desativar sem apagar para manter histórico.
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
                            <input type="hidden" name="id" value={preference.id} />
                            {preferenceIds.map((preferenceId) => (
                                <input
                                    key={preferenceId}
                                    type="hidden"
                                    name="preference_ids"
                                    value={preferenceId}
                                />
                            ))}
                            <WorkPreferenceFormFields
                                employeeId={employeeId}
                                fieldErrors={updateDialog.visibleState.fieldErrors}
                                preference={preference}
                                selectedWeekdays={groupedWeekdays}
                                shiftTypes={shiftTypes}
                            />

                            {updateDialog.visibleState.message ? (
                                <p className="text-sm text-destructive">
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
                                <SaveButton label="Guardar alterações" />
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialog.open} onOpenChange={deleteDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Apagar preferência">
                        <Trash2Icon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apagar preferência fixa</DialogTitle>
                        <DialogDescription>
                            Esta ação remove a preferência permanentemente.
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
                            <input type="hidden" name="id" value={preference.id} />
                            <input type="hidden" name="employee_id" value={employeeId} />
                            {preferenceIds.map((preferenceId) => (
                                <input
                                    key={preferenceId}
                                    type="hidden"
                                    name="preference_ids"
                                    value={preferenceId}
                                />
                            ))}
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
        </div>
    );
}

export function EmployeeWorkPreferencesSection({
    employeeId,
    preferences,
    shiftTypes,
}: EmployeeWorkPreferencesSectionProps) {
    const groupedPreferences = useMemo(() => {
        const grouped = new Map<string, GroupedWorkPreference>();

        for (const preference of preferences) {
            const normalizedNotes = (preference.notes ?? "").trim();
            const key = [
                preference.preference_type,
                preference.shift_type_id ?? "",
                preference.active ? "active" : "inactive",
                normalizedNotes,
            ].join("|");
            const existing = grouped.get(key);

            if (!existing) {
                grouped.set(key, {
                    key,
                    preferenceIds: [preference.id],
                    preferences: [preference],
                    representative: preference,
                    weekdays:
                        preference.weekday === null || preference.weekday === undefined
                            ? null
                            : [preference.weekday],
                });
                continue;
            }

            existing.preferenceIds.push(preference.id);
            existing.preferences.push(preference);
            if (existing.weekdays !== null) {
                if (preference.weekday === null || preference.weekday === undefined) {
                    existing.weekdays = null;
                } else if (!existing.weekdays.includes(preference.weekday)) {
                    existing.weekdays.push(preference.weekday);
                }
            }
        }

        return [...grouped.values()]
            .map((group) => ({
                ...group,
                weekdays:
                    group.weekdays === null
                        ? null
                        : [...group.weekdays].sort((a, b) => a - b),
            }))
            .sort((first, second) =>
                preferenceTypeLabel(first.representative.preference_type).localeCompare(
                    preferenceTypeLabel(second.representative.preference_type),
                    "pt-PT"
                )
            );
    }, [preferences]);

    return (
        <section className="rounded-lg border bg-card p-4 shadow-xs">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold">Preferências fixas</h2>
                    <p className="text-sm text-muted-foreground">
                        Regras permanentes que o gerador considera antes dos pedidos
                        mensais.
                    </p>
                </div>
                <NewWorkPreferenceDialog employeeId={employeeId} shiftTypes={shiftTypes} />
            </div>

            <div className="mb-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                    Exemplos para preencher preferências fixas
                </p>
                <p className="mt-1">
                    Tiago prefere tardes: tipo{" "}
                    <span className="font-medium">Prefere turno</span>, turno{" "}
                    <span className="font-medium">T</span>, notas{" "}
                    <span className="font-medium">&quot;Prefere tardes&quot;</span>.
                </p>
                <p className="mt-1">
                    Máximo semanal: tipo{" "}
                    <span className="font-medium">Máximo de turnos por semana</span>,
                    sem turno, notas com número (ex:{" "}
                    <span className="font-medium">&quot;4 por semana&quot;</span>).
                </p>
                <p className="mt-1">
                    Indisponibilidade recorrente: tipo{" "}
                    <span className="font-medium">Indisponível no dia da semana</span>,
                    escolher o dia (ex: sábado).
                </p>
            </div>

            {groupedPreferences.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Ainda não existem preferências fixas para este funcionário.
                </div>
            ) : (
                <div className="grid gap-2">
                    {groupedPreferences.map((group) => (
                        <div
                            key={group.key}
                            className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                            <div className="grid gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        {preferenceTypeLabel(
                                            group.representative.preference_type
                                        )}
                                    </Badge>
                                    <Badge variant="outline">
                                        {shiftTypeLabel(
                                            group.representative.shift_type_id,
                                            shiftTypes
                                        )}
                                    </Badge>
                                    <Badge variant="outline">
                                        {groupedWeekdayLabel(group.weekdays)}
                                    </Badge>
                                    <Badge
                                        variant={
                                            group.representative.active
                                                ? "secondary"
                                                : "outline"
                                        }
                                    >
                                        {group.representative.active ? "Ativa" : "Inativa"}
                                    </Badge>
                                    {group.preferenceIds.length > 1 ? (
                                        <Badge variant="outline">
                                            {group.preferenceIds.length} dias agrupados
                                        </Badge>
                                    ) : null}
                                </div>
                                {group.representative.notes ? (
                                    <p className="text-sm text-muted-foreground">
                                        {group.representative.notes}
                                    </p>
                                ) : null}
                            </div>
                            <WorkPreferenceRowActions
                                employeeId={employeeId}
                                groupedWeekdays={group.weekdays}
                                preference={group.representative}
                                preferenceIds={group.preferenceIds}
                                shiftTypes={shiftTypes}
                            />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
