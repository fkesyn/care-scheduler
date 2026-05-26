"use client";

import { AlertTriangleIcon, GripVerticalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
    clearScheduleEntry,
    reorderScheduleEmployees,
    upsertScheduleEntry,
} from "@/app/dashboard/schedules/actions";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ScheduleGridDay = {
    dateValue: string;
    day: number;
    holidayName?: string | null;
    isHoliday?: boolean;
    isWeekend: boolean;
    weekday: string;
};

export type ScheduleGridEmployee = {
    id: string;
    name: string;
    role: string;
};

export type ScheduleGridShiftType = {
    active: boolean | null;
    code: string;
    id: string;
    name: string;
};

export type ScheduleGridEntry = {
    employee_id: string;
    id: string;
    notes: string | null;
    shift_type_id: string;
    work_date: string;
};

export type ScheduleGridConstraint = {
    constraint_type: string;
    employee_id: string;
    end_date: string | null;
    id: string;
    notes: string | null;
    shift_type_id: string | null;
    source_text: string | null;
    specific_date: string | null;
    start_date: string | null;
};

type ScheduleGridProps = {
    constraints: ScheduleGridConstraint[];
    days: ScheduleGridDay[];
    employees: ScheduleGridEmployee[];
    entries: ScheduleGridEntry[];
    scheduleId: string;
    shiftTypes: ScheduleGridShiftType[];
};

type CellEvaluation = {
    hasConflict: boolean;
    hasInfo: boolean;
    messages: string[];
};

const dayOffCodes = new Set(["F", "FF", "Fe"]);

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

function buildCellKey(employeeId: string, dateValue: string) {
    return `${employeeId}:${dateValue}`;
}

function constraintTypeLabel(constraintType: string) {
    if (constraintType === "vacation") return "Férias";
    if (constraintType === "preferred_day_off") return "Folga pedida";
    if (constraintType === "unavailable_shift") return "Turno indisponível";
    if (constraintType === "avoid_shift") return "Evitar turno";
    if (constraintType === "preferred_shift") return "Turno preferido";
    if (constraintType === "only_shift") return "Só este turno";
    if (constraintType === "exception_allowed_shift") {
        return "Turno permitido por exceção";
    }

    return constraintType;
}

function constraintHasDateScope(constraint: ScheduleGridConstraint) {
    return Boolean(
        constraint.specific_date || constraint.start_date || constraint.end_date
    );
}

function constraintMatchesDate(
    constraint: ScheduleGridConstraint,
    dateValue: string
) {
    if (constraint.specific_date) {
        return constraint.specific_date === dateValue;
    }

    if (constraint.start_date || constraint.end_date) {
        const startDate = constraint.start_date ?? dateValue;
        const endDate = constraint.end_date ?? dateValue;

        return dateValue >= startDate && dateValue <= endDate;
    }

    return true;
}

function shiftName(
    shiftTypesById: Map<string, ScheduleGridShiftType>,
    shiftTypeId: string | null
) {
    if (!shiftTypeId) {
        return "qualquer turno";
    }

    const shiftType = shiftTypesById.get(shiftTypeId);

    if (!shiftType) {
        return "turno";
    }

    return `${shiftType.code} - ${shiftType.name}`;
}

function evaluateCell(
    constraints: ScheduleGridConstraint[],
    dateValue: string,
    selectedShiftType: ScheduleGridShiftType | null,
    shiftTypesById: Map<string, ScheduleGridShiftType>
): CellEvaluation {
    const selectedShiftTypeId = selectedShiftType?.id ?? null;
    const selectedShiftCode = selectedShiftType?.code ?? null;
    const messages: string[] = [];
    let hasConflict = false;
    let hasInfo = false;

    for (const constraint of constraints) {
        if (!constraintMatchesDate(constraint, dateValue)) {
            continue;
        }

        const hasDateScope = constraintHasDateScope(constraint);
        const requestedShift = shiftName(shiftTypesById, constraint.shift_type_id);
        const label = constraintTypeLabel(constraint.constraint_type);

        if (constraint.constraint_type === "vacation") {
            hasInfo = true;
            messages.push(`${label}: ${constraint.notes ?? "período marcado"}`);

            if (selectedShiftCode && selectedShiftCode !== "Fe") {
                hasConflict = true;
            }

            continue;
        }

        if (constraint.constraint_type === "preferred_day_off") {
            hasInfo = true;
            messages.push(`${label}: ${constraint.notes ?? "pedido de folga"}`);

            if (selectedShiftCode && !dayOffCodes.has(selectedShiftCode)) {
                hasConflict = true;
            }

            continue;
        }

        if (
            constraint.constraint_type === "unavailable_shift" ||
            constraint.constraint_type === "avoid_shift"
        ) {
            const shiftMatches =
                !constraint.shift_type_id ||
                constraint.shift_type_id === selectedShiftTypeId;

            if (hasDateScope || shiftMatches) {
                hasInfo = true;
                messages.push(`${label}: ${requestedShift}`);
            }

            if (selectedShiftTypeId && shiftMatches) {
                hasConflict = true;
            }

            continue;
        }

        if (constraint.constraint_type === "only_shift") {
            if (hasDateScope || selectedShiftTypeId) {
                hasInfo = true;
                messages.push(`${label}: ${requestedShift}`);
            }

            if (
                selectedShiftTypeId &&
                constraint.shift_type_id &&
                constraint.shift_type_id !== selectedShiftTypeId
            ) {
                hasConflict = true;
            }

            continue;
        }

        if (constraint.constraint_type === "preferred_shift") {
            if (hasDateScope || selectedShiftTypeId) {
                hasInfo = true;
                messages.push(`${label}: ${requestedShift}`);
            }

            if (
                selectedShiftTypeId &&
                constraint.shift_type_id &&
                constraint.shift_type_id !== selectedShiftTypeId
            ) {
                hasConflict = true;
            }

            continue;
        }

        if (constraint.constraint_type === "exception_allowed_shift") {
            if (
                hasDateScope ||
                !constraint.shift_type_id ||
                constraint.shift_type_id === selectedShiftTypeId
            ) {
                hasInfo = true;
                messages.push(`${label}: ${requestedShift}`);
            }
        }
    }

    return {
        hasConflict,
        hasInfo,
        messages,
    };
}

export function ScheduleGrid({
    constraints,
    days,
    employees,
    entries,
    scheduleId,
    shiftTypes,
}: ScheduleGridProps) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    const [employeeOrder, setEmployeeOrder] = useState<string[]>(() =>
        employees.map((employee) => employee.id)
    );
    const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
    const [dragOverEmployeeId, setDragOverEmployeeId] = useState<string | null>(null);

    const entriesByCell = useMemo(() => {
        return new Map(
            entries.map((entry) => [
                buildCellKey(entry.employee_id, entry.work_date),
                entry,
            ])
        );
    }, [entries]);

    const constraintsByEmployee = useMemo(() => {
        const grouped = new Map<string, ScheduleGridConstraint[]>();

        for (const constraint of constraints) {
            const current = grouped.get(constraint.employee_id) ?? [];
            current.push(constraint);
            grouped.set(constraint.employee_id, current);
        }

        return grouped;
    }, [constraints]);

    const shiftTypesById = useMemo(() => {
        return new Map(shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
    }, [shiftTypes]);
    const employeesById = useMemo(() => {
        return new Map(employees.map((employee) => [employee.id, employee]));
    }, [employees]);
    const orderedEmployees = useMemo(() => {
        const defaultEmployeeIds = employees.map((employee) => employee.id);
        const candidateOrder =
            employeeOrder.length > 0 ? employeeOrder : defaultEmployeeIds;
        const normalizedOrder = candidateOrder.filter((employeeId) =>
            defaultEmployeeIds.includes(employeeId)
        );
        const missingEmployeeIds = defaultEmployeeIds.filter(
            (employeeId) => !normalizedOrder.includes(employeeId)
        );
        const finalOrder = [...normalizedOrder, ...missingEmployeeIds];

        const sortedEmployees = finalOrder
            .map((employeeId) => employeesById.get(employeeId))
            .filter((employee): employee is ScheduleGridEmployee => Boolean(employee));

        if (sortedEmployees.length === 0) {
            return employees;
        }

        return sortedEmployees;
    }, [employeeOrder, employeesById, employees]);

    const gridTemplateColumns = `minmax(13rem, 1.4fr) repeat(${days.length}, minmax(3.25rem, 1fr))`;

    function mutateCell(
        cellKey: string,
        employeeId: string,
        workDate: string,
        nextShiftTypeId: string,
        previousShiftTypeId: string
    ) {
        setSavingCellKey(cellKey);
        setErrorMessage(null);
        setLocalValues((current) => ({
            ...current,
            [cellKey]: nextShiftTypeId,
        }));

        startTransition(() => {
            void (async () => {
                const result = nextShiftTypeId
                    ? await upsertScheduleEntry({
                          employeeId,
                          scheduleId,
                          shiftTypeId: nextShiftTypeId,
                          workDate,
                      })
                    : await clearScheduleEntry({
                          employeeId,
                          scheduleId,
                          workDate,
                      });

                if (result.status === "error") {
                    setLocalValues((current) => ({
                        ...current,
                        [cellKey]: previousShiftTypeId,
                    }));
                    setErrorMessage(result.message ?? "Não consegui guardar a célula.");
                } else {
                    router.refresh();
                }

                setSavingCellKey(null);
            })();
        });
    }

    function moveEmployeeBeforeTarget(draggedId: string, targetId: string) {
        if (!draggedId || !targetId || draggedId === targetId) {
            return;
        }

        let nextOrderSnapshot: string[] | null = null;

        setEmployeeOrder((currentOrder) => {
            const draggedIndex = currentOrder.indexOf(draggedId);
            const targetIndex = currentOrder.indexOf(targetId);

            if (draggedIndex === -1 || targetIndex === -1) {
                return currentOrder;
            }

            const nextOrder = [...currentOrder];
            nextOrder.splice(draggedIndex, 1);
            const nextTargetIndex = nextOrder.indexOf(targetId);
            nextOrder.splice(nextTargetIndex, 0, draggedId);
            nextOrderSnapshot = nextOrder;

            return nextOrder;
        });

        if (!nextOrderSnapshot) {
            return;
        }

        startTransition(() => {
            void (async () => {
                const result = await reorderScheduleEmployees({
                    employeeIds: nextOrderSnapshot ?? [],
                    scheduleId,
                });

                if (result.status === "error") {
                    setErrorMessage(
                        result.message ?? "Não consegui guardar ordem dos funcionários."
                    );
                } else {
                    setErrorMessage(null);
                }
            })();
        });
    }

    return (
        <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
            <div className="flex flex-col gap-1 border-b p-4">
                <h2 className="text-base font-semibold">Grelha mensal</h2>
                <p className="text-sm text-muted-foreground">
                    Clica numa célula para escolher turno ou limpar com “-”.
                </p>
                {errorMessage ? (
                    <p
                        className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        role="alert"
                    >
                        {errorMessage}
                    </p>
                ) : null}
            </div>

            {orderedEmployees.length === 0 ? (
                <div className="flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Ainda não há pessoas na equipa para mostrar na grelha.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-max">
                        <div
                            className="grid border-b bg-muted/50 text-xs font-medium text-muted-foreground"
                            style={{ gridTemplateColumns }}
                        >
                            <div className="sticky left-0 z-20 border-r bg-muted/50 p-3">
                                Pessoa
                            </div>
                            {days.map((day) => (
                                <div
                                    key={day.dateValue}
                                    className={cn(
                                        "border-r p-2 text-center last:border-r-0",
                                        day.isWeekend &&
                                            "bg-slate-300/70 dark:bg-slate-700/60",
                                        day.isHoliday &&
                                            "bg-amber-100/80 text-amber-950 dark:bg-amber-900/20 dark:text-amber-100"
                                    )}
                                    title={day.holidayName ?? undefined}
                                >
                                    <div className="font-semibold text-foreground">
                                        {day.day}
                                    </div>
                                    <div className="capitalize">{day.weekday}</div>
                                    {day.holidayName ? (
                                        <div className="truncate text-[10px] font-medium normal-case">
                                            {day.holidayName}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>

                        {orderedEmployees.map((employee) => {
                            const employeeConstraints =
                                constraintsByEmployee.get(employee.id) ?? [];
                            const isDragOver =
                                draggedEmployeeId &&
                                dragOverEmployeeId === employee.id &&
                                draggedEmployeeId !== employee.id;

                            return (
                                <div
                                    key={employee.id}
                                    className={cn(
                                        "grid border-b last:border-b-0",
                                        isDragOver && "bg-sky-50/60 dark:bg-sky-950/20"
                                    )}
                                    style={{ gridTemplateColumns }}
                                    onDragOver={(event) => {
                                        if (!draggedEmployeeId) {
                                            return;
                                        }

                                        event.preventDefault();
                                        setDragOverEmployeeId(employee.id);
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();

                                        if (!draggedEmployeeId) {
                                            return;
                                        }

                                        moveEmployeeBeforeTarget(
                                            draggedEmployeeId,
                                            employee.id
                                        );
                                        setDragOverEmployeeId(null);
                                    }}
                                    onDragLeave={() => {
                                        if (dragOverEmployeeId === employee.id) {
                                            setDragOverEmployeeId(null);
                                        }
                                    }}
                                >
                                    <div className="sticky left-0 z-10 border-r bg-card p-3">
                                        <div className="flex min-w-0 items-start gap-2">
                                            <button
                                                type="button"
                                                aria-label={`Reordenar ${employee.name}`}
                                                className="mt-0.5 cursor-grab rounded-sm p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                                                draggable
                                                onDragStart={(event) => {
                                                    event.dataTransfer.effectAllowed = "move";
                                                    setDraggedEmployeeId(employee.id);
                                                    setDragOverEmployeeId(employee.id);
                                                }}
                                                onDragEnd={() => {
                                                    setDraggedEmployeeId(null);
                                                    setDragOverEmployeeId(null);
                                                }}
                                            >
                                                <GripVerticalIcon
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                            <div className="flex min-w-0 flex-col gap-1">
                                                <span className="truncate text-sm font-medium">
                                                    {employee.name}
                                                </span>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {roleLabel(employee.role)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {days.map((day) => {
                                        const cellKey = buildCellKey(
                                            employee.id,
                                            day.dateValue
                                        );
                                        const entry = entriesByCell.get(cellKey);
                                        const selectedShiftTypeId =
                                            localValues[cellKey] ??
                                            entry?.shift_type_id ??
                                            "";
                                        const selectedShiftType = selectedShiftTypeId
                                            ? shiftTypesById.get(selectedShiftTypeId) ??
                                              null
                                            : null;
                                        const evaluation = evaluateCell(
                                            employeeConstraints,
                                            day.dateValue,
                                            selectedShiftType,
                                            shiftTypesById
                                        );
                                        const isSaving = savingCellKey === cellKey;
                                        const tooltip = evaluation.messages.join("\n");

                                        return (
                                            <div
                                                key={day.dateValue}
                                                className={cn(
                                                    "relative flex min-h-14 items-center justify-center border-r p-1.5 text-center last:border-r-0",
                                                    day.isWeekend &&
                                                        "bg-slate-200/70 dark:bg-slate-800/45",
                                                    day.isHoliday &&
                                                        "bg-amber-50/80 dark:bg-amber-950/20",
                                                    evaluation.hasInfo &&
                                                        "bg-sky-50/70 dark:bg-sky-950/20",
                                                    evaluation.hasConflict &&
                                                        "bg-amber-50 ring-1 ring-inset ring-amber-300 dark:bg-amber-950/25 dark:ring-amber-800"
                                                )}
                                                title={tooltip || undefined}
                                            >
                                                {evaluation.hasConflict ? (
                                                    <AlertTriangleIcon
                                                        className="pointer-events-none absolute top-1 right-1 size-3.5 text-amber-600"
                                                        aria-hidden="true"
                                                    />
                                                ) : evaluation.hasInfo ? (
                                                    <span
                                                        className="pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-sky-500"
                                                        aria-hidden="true"
                                                    />
                                                ) : null}

                                                <select
                                                    aria-label={`${employee.name}, ${day.dateValue}`}
                                                    className={cn(
                                                        "h-9 w-full rounded-md border border-input bg-background px-1 text-center font-mono text-xs font-semibold shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-70",
                                                        evaluation.hasConflict &&
                                                            "border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                                                    )}
                                                    disabled={Boolean(savingCellKey)}
                                                    value={selectedShiftTypeId}
                                                    onChange={(event) => {
                                                        mutateCell(
                                                            cellKey,
                                                            employee.id,
                                                            day.dateValue,
                                                            event.target.value,
                                                            selectedShiftTypeId
                                                        );
                                                    }}
                                                >
                                                    <option value="">-</option>
                                                    {shiftTypes.map((shiftType) => (
                                                        <option
                                                            key={shiftType.id}
                                                            value={shiftType.id}
                                                            disabled={
                                                                shiftType.active === false
                                                            }
                                                        >
                                                            {shiftType.code}
                                                        </option>
                                                    ))}
                                                </select>

                                                {isSaving ? (
                                                    <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-background/90 p-0.5">
                                                        <Spinner className="size-3" />
                                                    </span>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-2 border-t bg-muted/20 p-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-sky-500" />
                    Pedido/restrição aplicável
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-amber-400" />
                    Feriado
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-slate-400" />
                    Fim de semana
                </span>
                <span className="inline-flex items-center gap-1">
                    <AlertTriangleIcon className="size-3.5 text-amber-600" />
                    Possível conflito com o pedido
                </span>
                <Badge variant="outline" className="font-mono">
                    -
                </Badge>
                Limpar célula
            </div>
        </section>
    );
}
