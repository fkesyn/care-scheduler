"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
    clearScheduleConstraints,
    type ClearScheduleConstraintsState,
    createScheduleConstraint,
    deleteScheduleConstraint,
    type DeleteScheduleConstraintState,
    type ScheduleConstraintFormState,
    updateScheduleConstraint,
} from "@/app/dashboard/schedules/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

import { ImportConstraintsDialog } from "./import-constraints-dialog";

type Relation<T> = T | T[] | null;

export type ScheduleConstraintEmployee = {
    id: string;
    name: string;
    role: string;
};

export type ScheduleConstraintShiftType = {
    id: string;
    code: string;
    name: string;
    active: boolean | null;
};

export type ScheduleConstraintRow = {
    id: string;
    employee_id: string;
    constraint_type: string;
    shift_type_id: string | null;
    specific_date: string | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
    source_text: string | null;
    shift_types: Relation<{
        id: string;
        code: string;
        name: string;
    }>;
};

type ScheduleConstraintsSectionProps = {
    canManage?: boolean;
    constraints: ScheduleConstraintRow[];
    employees: ScheduleConstraintEmployee[];
    monthEnd: string;
    monthStart: string;
    scheduleId: string;
    showHeaderActions?: boolean;
    shiftTypes: ScheduleConstraintShiftType[];
};

type ConstraintFormFieldsProps = {
    constraint?: ScheduleConstraintRow;
    employees: ScheduleConstraintEmployee[];
    fieldErrors?: ScheduleConstraintFormState["fieldErrors"];
    monthEnd: string;
    monthStart: string;
    scheduleId: string;
    shiftTypes: ScheduleConstraintShiftType[];
};

const createInitialState: ScheduleConstraintFormState = {
    status: "idle",
};

const updateInitialState: ScheduleConstraintFormState = {
    status: "idle",
};

const deleteInitialState: DeleteScheduleConstraintState = {
    status: "idle",
};

const clearInitialState: ClearScheduleConstraintsState = {
    status: "idle",
};

const constraintTypeOptions = [
    { value: "vacation", label: "Férias" },
    { value: "preferred_day_off", label: "Folga pedida" },
    { value: "unavailable_shift", label: "Não pode fazer turno" },
    { value: "avoid_shift", label: "Evitar turno" },
    { value: "preferred_shift", label: "Prefere turno" },
    { value: "only_shift", label: "Só pode fazer turno" },
    { value: "exception_allowed_shift", label: "Turno permitido por exceção" },
];

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function constraintTypeLabel(constraintType: string) {
    return (
        constraintTypeOptions.find((option) => option.value === constraintType)
            ?.label ?? constraintType
    );
}

function isWeeklyShiftTargetConstraint(constraint: ScheduleConstraintRow) {
    if (constraint.constraint_type !== "preferred_shift" || !constraint.notes) {
        return false;
    }

    const normalizedNotes = constraint.notes.toLocaleLowerCase("pt-PT");

    return (
        normalizedNotes.includes("objetivo") &&
        normalizedNotes.includes("turno") &&
        normalizedNotes.includes("nesta semana")
    );
}

function constraintDisplayLabel(constraint: ScheduleConstraintRow) {
    if (isWeeklyShiftTargetConstraint(constraint)) {
        return "Objetivo semanal de turno";
    }

    return constraintTypeLabel(constraint.constraint_type);
}

function roleLabel(role: string) {
    if (role === "nurse") {
        return "Enfermeiro/a";
    }

    if (role === "caregiver") {
        return "Cuidador/a";
    }

    if (role === "other") {
        return "Outro";
    }

    return "Auxiliar / Funcionário";
}

function formatDate(dateValue: string | null) {
    if (!dateValue) {
        return null;
    }

    return new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "short",
    }).format(new Date(`${dateValue}T00:00:00`));
}

function formatConstraintDate(constraint: ScheduleConstraintRow) {
    const specificDate = formatDate(constraint.specific_date);

    if (specificDate) {
        return specificDate;
    }

    const startDate = formatDate(constraint.start_date);
    const endDate = formatDate(constraint.end_date);

    if (startDate && endDate) {
        return `${startDate} - ${endDate}`;
    }

    if (startDate) {
        return `Desde ${startDate}`;
    }

    if (endDate) {
        return `Até ${endDate}`;
    }

    return "Sem data";
}

function SubmitButton({ children }: { children: string }) {
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
            {pending ? "A apagar..." : "Apagar pedido"}
        </Button>
    );
}

function ClearAllButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" disabled={pending}>
            <Trash2Icon />
            {pending ? "A limpar..." : "Limpar restrições"}
        </Button>
    );
}

function ConstraintFormFields({
    constraint,
    employees,
    fieldErrors,
    monthEnd,
    monthStart,
    scheduleId,
    shiftTypes,
}: ConstraintFormFieldsProps) {
    const idPrefix = constraint?.id ?? "new";

    return (
        <>
            <input type="hidden" name="schedule_id" value={scheduleId} />
            {constraint ? (
                <input type="hidden" name="id" value={constraint.id} />
            ) : null}

            <div className="grid gap-2">
                <Label htmlFor={`constraint-employee-${idPrefix}`}>Funcionário</Label>
                <select
                    id={`constraint-employee-${idPrefix}`}
                    name="employee_id"
                    defaultValue={constraint?.employee_id ?? employees[0]?.id ?? ""}
                    className={cn(
                        "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        fieldErrors?.employeeId &&
                            "border-destructive ring-3 ring-destructive/20"
                    )}
                    aria-invalid={Boolean(fieldErrors?.employeeId)}
                    required
                >
                    {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                            {employee.name}
                        </option>
                    ))}
                </select>
                {fieldErrors?.employeeId ? (
                    <p className="text-sm text-destructive">{fieldErrors.employeeId}</p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`constraint-type-${idPrefix}`}>
                    Tipo de restrição
                </Label>
                <select
                    id={`constraint-type-${idPrefix}`}
                    name="constraint_type"
                    defaultValue={constraint?.constraint_type ?? "vacation"}
                    className={cn(
                        "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        fieldErrors?.constraintType &&
                            "border-destructive ring-3 ring-destructive/20"
                    )}
                    aria-invalid={Boolean(fieldErrors?.constraintType)}
                    required
                >
                    {constraintTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {fieldErrors?.constraintType ? (
                    <p className="text-sm text-destructive">
                        {fieldErrors.constraintType}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`constraint-shift-${idPrefix}`}>Turno</Label>
                <select
                    id={`constraint-shift-${idPrefix}`}
                    name="shift_type_id"
                    defaultValue={constraint?.shift_type_id ?? ""}
                    className={cn(
                        "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        fieldErrors?.shiftTypeId &&
                            "border-destructive ring-3 ring-destructive/20"
                    )}
                    aria-invalid={Boolean(fieldErrors?.shiftTypeId)}
                >
                    <option value="">Sem turno específico</option>
                    {shiftTypes.map((shiftType) => (
                        <option key={shiftType.id} value={shiftType.id}>
                            {shiftType.code} - {shiftType.name}
                        </option>
                    ))}
                </select>
                {fieldErrors?.shiftTypeId ? (
                    <p className="text-sm text-destructive">
                        {fieldErrors.shiftTypeId}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                    <Label htmlFor={`constraint-specific-date-${idPrefix}`}>
                        Data específica
                    </Label>
                    <Input
                        id={`constraint-specific-date-${idPrefix}`}
                        name="specific_date"
                        type="date"
                        min={monthStart}
                        max={monthEnd}
                        defaultValue={constraint?.specific_date ?? ""}
                        aria-invalid={Boolean(fieldErrors?.specificDate)}
                    />
                    {fieldErrors?.specificDate ? (
                        <p className="text-sm text-destructive">
                            {fieldErrors.specificDate}
                        </p>
                    ) : null}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`constraint-start-date-${idPrefix}`}>
                        Data início
                    </Label>
                    <Input
                        id={`constraint-start-date-${idPrefix}`}
                        name="start_date"
                        type="date"
                        min={monthStart}
                        max={monthEnd}
                        defaultValue={constraint?.start_date ?? ""}
                        aria-invalid={Boolean(fieldErrors?.startDate)}
                    />
                    {fieldErrors?.startDate ? (
                        <p className="text-sm text-destructive">
                            {fieldErrors.startDate}
                        </p>
                    ) : null}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`constraint-end-date-${idPrefix}`}>Data fim</Label>
                    <Input
                        id={`constraint-end-date-${idPrefix}`}
                        name="end_date"
                        type="date"
                        min={monthStart}
                        max={monthEnd}
                        defaultValue={constraint?.end_date ?? ""}
                        aria-invalid={Boolean(fieldErrors?.endDate)}
                    />
                    {fieldErrors?.endDate ? (
                        <p className="text-sm text-destructive">
                            {fieldErrors.endDate}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`constraint-notes-${idPrefix}`}>Notas</Label>
                <Textarea
                    id={`constraint-notes-${idPrefix}`}
                    name="notes"
                    defaultValue={constraint?.notes ?? ""}
                    placeholder="Ex.: pediu para evitar este turno"
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`constraint-source-text-${idPrefix}`}>
                    Texto original
                </Label>
                <Textarea
                    id={`constraint-source-text-${idPrefix}`}
                    name="source_text"
                    defaultValue={constraint?.source_text ?? ""}
                    placeholder="Ex.: dia 16 não posso fazer tarde"
                />
            </div>
        </>
    );
}

export function NewConstraintDialog({
    employees,
    monthEnd,
    monthStart,
    scheduleId,
    shiftTypes,
}: Omit<ScheduleConstraintsSectionProps, "constraints">) {
    const [state, formAction] = useActionState(
        createScheduleConstraint,
        createInitialState
    );
    const { closeDialog, open, setOpen, showFormAgain, visibleState } =
        useActionDialog(state, createInitialState);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (visibleState.status === "success") {
            formRef.current?.reset();
        }
    }, [visibleState.status]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={employees.length === 0}>
                    <PlusIcon />
                    Adicionar pedido/restrição
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Adicionar pedido/restrição</DialogTitle>
                    <DialogDescription>
                        Regista manualmente férias, folgas pedidas ou preferências.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                            {visibleState.message}
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Adicionar outro
                            </Button>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form ref={formRef} action={formAction} className="grid gap-4">
                        <ConstraintFormFields
                            employees={employees}
                            fieldErrors={visibleState.fieldErrors}
                            monthEnd={monthEnd}
                            monthStart={monthStart}
                            scheduleId={scheduleId}
                            shiftTypes={shiftTypes}
                        />

                        {visibleState.message ? (
                            <p
                                className={cn(
                                    "text-sm",
                                    visibleState.status === "error"
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                )}
                            >
                                {visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancelar
                            </Button>
                            <SubmitButton>Guardar pedido</SubmitButton>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function ClearConstraintsDialog({
    constraintsCount,
    scheduleId,
}: {
    constraintsCount: number;
    scheduleId: string;
}) {
    const [state, formAction] = useActionState(
        clearScheduleConstraints,
        clearInitialState
    );
    const { closeDialog, open, setOpen, visibleState } = useActionDialog(
        state,
        clearInitialState
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" disabled={constraintsCount === 0}>
                    <Trash2Icon />
                    Limpar restrições
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Limpar pedidos/restrições</DialogTitle>
                    <DialogDescription>
                        Esta ação apaga todos os pedidos e restrições registados para
                        este mês.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                            {visibleState.message}
                        </p>
                        <DialogFooter>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form action={formAction} className="grid gap-4">
                        <input type="hidden" name="schedule_id" value={scheduleId} />
                        <p className="text-sm text-muted-foreground">
                            Vais apagar{" "}
                            <strong>
                                {constraintsCount}{" "}
                                {constraintsCount === 1
                                    ? "pedido/restrição"
                                    : "pedidos/restrições"}
                            </strong>{" "}
                            deste mês. A grelha de horários não será alterada.
                        </p>

                        {visibleState.status === "error" && visibleState.message ? (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                {visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancelar
                            </Button>
                            <ClearAllButton />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

function ConstraintRowActions({
    constraint,
    employees,
    monthEnd,
    monthStart,
    scheduleId,
    shiftTypes,
}: Omit<ScheduleConstraintsSectionProps, "constraints"> & {
    constraint: ScheduleConstraintRow;
}) {
    const [updateState, updateAction] = useActionState(
        updateScheduleConstraint,
        updateInitialState
    );
    const [deleteState, deleteAction] = useActionState(
        deleteScheduleConstraint,
        deleteInitialState
    );
    const updateDialog = useActionDialog(updateState, updateInitialState);
    const deleteDialog = useActionDialog(deleteState, deleteInitialState);

    return (
        <div className="flex shrink-0 gap-1">
            <Dialog open={updateDialog.open} onOpenChange={updateDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Editar pedido/restrição"
                    >
                        <PencilIcon />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar pedido/restrição</DialogTitle>
                        <DialogDescription>
                            Atualiza o funcionário, datas, turno ou notas.
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
                            <ConstraintFormFields
                                constraint={constraint}
                                employees={employees}
                                fieldErrors={updateDialog.visibleState.fieldErrors}
                                monthEnd={monthEnd}
                                monthStart={monthStart}
                                scheduleId={scheduleId}
                                shiftTypes={shiftTypes}
                            />

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

            <Dialog open={deleteDialog.open} onOpenChange={deleteDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Apagar pedido/restrição"
                    >
                        <Trash2Icon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apagar pedido/restrição</DialogTitle>
                        <DialogDescription>
                            Esta ação remove apenas este pedido manual.
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
                            <input type="hidden" name="schedule_id" value={scheduleId} />
                            <input type="hidden" name="id" value={constraint.id} />
                            <p className="text-sm text-muted-foreground">
                                Vais apagar o pedido{" "}
                                <strong>{constraintTypeLabel(constraint.constraint_type)}</strong>.
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
        </div>
    );
}

export function ScheduleConstraintsSection({
    canManage = true,
    constraints,
    employees,
    monthEnd,
    monthStart,
    scheduleId,
    showHeaderActions = true,
    shiftTypes,
}: ScheduleConstraintsSectionProps) {
    const constraintsByEmployee = useMemo(() => {
        const grouped = new Map<string, ScheduleConstraintRow[]>();

        for (const constraint of constraints) {
            const employeeConstraints =
                grouped.get(constraint.employee_id) ?? [];
            employeeConstraints.push(constraint);
            grouped.set(constraint.employee_id, employeeConstraints);
        }

        return grouped;
    }, [constraints]);

    return (
        <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
            <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold">Pedidos e restrições</h2>
                    <p className="text-sm text-muted-foreground">
                        {constraints.length}{" "}
                        {constraints.length === 1
                            ? "pedido registado"
                            : "pedidos registados"}{" "}
                        para este mês.
                    </p>
                </div>

                {showHeaderActions && canManage ? (
                    <div className="flex flex-wrap gap-2">
                        <ImportConstraintsDialog
                            employees={employees}
                            monthEnd={monthEnd}
                            monthStart={monthStart}
                            scheduleId={scheduleId}
                            shiftTypes={shiftTypes}
                        />
                        <ClearConstraintsDialog
                            constraintsCount={constraints.length}
                            scheduleId={scheduleId}
                        />
                        <NewConstraintDialog
                            employees={employees}
                            monthEnd={monthEnd}
                            monthStart={monthStart}
                            scheduleId={scheduleId}
                            shiftTypes={shiftTypes}
                        />
                    </div>
                ) : null}
            </div>

            {employees.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Ainda não há funcionários ativos para registar pedidos.
                </div>
            ) : (
                <div className="divide-y">
                    {employees.map((employee) => {
                        const employeeConstraints =
                            constraintsByEmployee.get(employee.id) ?? [];

                        return (
                            <div key={employee.id} className="grid gap-3 p-4">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-medium">
                                            {employee.name}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {roleLabel(employee.role)}
                                        </p>
                                    </div>
                                    <Badge variant="outline">
                                        {employeeConstraints.length}{" "}
                                        {employeeConstraints.length === 1
                                            ? "pedido"
                                            : "pedidos"}
                                    </Badge>
                                </div>

                                {employeeConstraints.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sem pedidos ou restrições para este mês.
                                    </p>
                                ) : (
                                    <div className="grid gap-2">
                                        {employeeConstraints.map((constraint) => {
                                            const shiftType = firstRelation(
                                                constraint.shift_types
                                            );

                                            return (
                                                <div
                                                    key={constraint.id}
                                                    className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-start sm:justify-between"
                                                >
                                                    <div className="grid min-w-0 gap-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge variant="secondary">
                                                                {constraintDisplayLabel(
                                                                    constraint
                                                                )}
                                                            </Badge>
                                                            {shiftType ? (
                                                                <Badge
                                                                    className="font-mono"
                                                                    variant="outline"
                                                                >
                                                                    {shiftType.code}
                                                                </Badge>
                                                            ) : null}
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatConstraintDate(
                                                                    constraint
                                                                )}
                                                            </span>
                                                        </div>

                                                        {constraint.notes ? (
                                                            <p className="text-sm text-muted-foreground">
                                                                {constraint.notes}
                                                            </p>
                                                        ) : null}

                                                        {constraint.source_text ? (
                                                            <p className="rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                                                                {constraint.source_text}
                                                            </p>
                                                        ) : null}
                                                    </div>

                                                    {canManage ? (
                                                        <ConstraintRowActions
                                                            constraint={constraint}
                                                            employees={employees}
                                                            monthEnd={monthEnd}
                                                            monthStart={monthStart}
                                                            scheduleId={scheduleId}
                                                            shiftTypes={shiftTypes}
                                                        />
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
