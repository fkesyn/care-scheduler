"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    deleteEmployee,
    type DeleteEmployeeState,
    updateEmployee,
    type UpdateEmployeeState,
} from "@/app/dashboard/employees/actions";
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

type Employee = {
    id: string;
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    professional_license_number: string | null;
    notes: string | null;
    active: boolean | null;
};

type EmployeeRowActionsProps = {
    employee: Employee;
};

const updateInitialState: UpdateEmployeeState = {
    status: "idle",
};

const deleteInitialState: DeleteEmployeeState = {
    status: "idle",
};

const roleOptions = [
    { value: "nurse", label: "Enfermeiro/a" },
    { value: "assistant", label: "Auxiliar / Funcionário" },
    { value: "caregiver", label: "Cuidador/a" },
    { value: "other", label: "Outro" },
];

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
            {pending ? "A apagar..." : "Apagar pessoa"}
        </Button>
    );
}

export function EmployeeRowActions({ employee }: EmployeeRowActionsProps) {
    const [updateState, updateAction] = useActionState(
        updateEmployee,
        updateInitialState
    );
    const [deleteState, deleteAction] = useActionState(
        deleteEmployee,
        deleteInitialState
    );
    const updateDialog = useActionDialog(updateState, updateInitialState);
    const deleteDialog = useActionDialog(deleteState, deleteInitialState);

    return (
        <div className="flex justify-end gap-2">
            <Dialog open={updateDialog.open} onOpenChange={updateDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Editar pessoa">
                        <PencilIcon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar pessoa</DialogTitle>
                        <DialogDescription>
                            Atualiza contactos, categoria e estado.
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
                            <input type="hidden" name="id" value={employee.id} />

                            <div className="grid gap-2">
                                <Label htmlFor={`employee-name-${employee.id}`}>
                                    Nome
                                </Label>
                                <Input
                                    id={`employee-name-${employee.id}`}
                                    name="name"
                                    defaultValue={employee.name}
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

                            <div className="grid gap-2">
                                <Label htmlFor={`employee-role-${employee.id}`}>
                                    Categoria
                                </Label>
                                <select
                                    id={`employee-role-${employee.id}`}
                                    name="role"
                                    defaultValue={employee.role}
                                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    aria-invalid={Boolean(
                                        updateDialog.visibleState.fieldErrors?.role
                                    )}
                                    required
                                >
                                    {roleOptions.map((role) => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                                {updateDialog.visibleState.fieldErrors?.role ? (
                                    <p className="text-sm text-destructive">
                                        {updateDialog.visibleState.fieldErrors.role}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor={`employee-phone-${employee.id}`}>
                                        Telefone
                                    </Label>
                                    <Input
                                        id={`employee-phone-${employee.id}`}
                                        name="phone"
                                        type="tel"
                                        defaultValue={employee.phone ?? ""}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor={`employee-email-${employee.id}`}>
                                        Email
                                    </Label>
                                    <Input
                                        id={`employee-email-${employee.id}`}
                                        name="email"
                                        type="email"
                                        defaultValue={employee.email ?? ""}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`employee-license-${employee.id}`}>
                                    Cédula profissional
                                </Label>
                                <Input
                                    id={`employee-license-${employee.id}`}
                                    name="professional_license_number"
                                    defaultValue={
                                        employee.professional_license_number ?? ""
                                    }
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`employee-notes-${employee.id}`}>
                                    Notas
                                </Label>
                                <Textarea
                                    id={`employee-notes-${employee.id}`}
                                    name="notes"
                                    defaultValue={employee.notes ?? ""}
                                />
                            </div>

                            <Label className="flex h-9 items-center gap-2 rounded-md border px-3">
                                <input
                                    type="checkbox"
                                    name="active"
                                    defaultChecked={Boolean(employee.active)}
                                    className="size-4 rounded border-input accent-foreground"
                                />
                                Ativo
                            </Label>

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
                    <Button size="icon-sm" variant="ghost" aria-label="Apagar pessoa">
                        <Trash2Icon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apagar pessoa</DialogTitle>
                        <DialogDescription>
                            Esta ação apaga definitivamente esta pessoa da equipa.
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
                            <input type="hidden" name="id" value={employee.id} />
                            <p className="text-sm text-muted-foreground">
                                Vais apagar <strong>{employee.name}</strong>. As
                                marcações existentes ficam sem responsável.
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
