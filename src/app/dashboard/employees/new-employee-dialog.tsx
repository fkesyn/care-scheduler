"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
    createEmployee,
    type CreateEmployeeState,
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

const initialState: CreateEmployeeState = {
    status: "idle",
};

const roleOptions = [
    { value: "nurse", label: "Enfermeiro/a" },
    { value: "assistant", label: "Auxiliar / Funcionário" },
    { value: "caregiver", label: "Cuidador/a" },
    { value: "other", label: "Outro" },
];

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : "Adicionar à equipa"}
        </Button>
    );
}

export function NewEmployeeDialog() {
    const [state, formAction] = useActionState(createEmployee, initialState);
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
                    <PlusIcon />
                    Nova pessoa
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova pessoa</DialogTitle>
                    <DialogDescription>
                        Adiciona enfermeiros, auxiliares ou funcionários à equipa.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleState.message ?? "Pessoa adicionada à equipa."}
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Adicionar outra pessoa
                            </Button>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                <form ref={formRef} action={formAction} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="employee-name">Nome</Label>
                        <Input
                            id="employee-name"
                            name="name"
                            placeholder="Ex.: Ana Silva"
                            aria-describedby={
                                visibleState.fieldErrors?.name
                                    ? "employee-name-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.name)}
                            required
                        />
                        {visibleState.fieldErrors?.name ? (
                            <p id="employee-name-error" className="text-sm text-destructive">
                                {visibleState.fieldErrors.name}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="employee-role">Categoria</Label>
                        <select
                            id="employee-role"
                            name="role"
                            defaultValue="assistant"
                            className={cn(
                                "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                visibleState.fieldErrors?.role &&
                                    "border-destructive ring-3 ring-destructive/20"
                            )}
                            aria-describedby={
                                visibleState.fieldErrors?.role
                                    ? "employee-role-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.role)}
                            required
                        >
                            {roleOptions.map((role) => (
                                <option key={role.value} value={role.value}>
                                    {role.label}
                                </option>
                            ))}
                        </select>
                        {visibleState.fieldErrors?.role ? (
                            <p id="employee-role-error" className="text-sm text-destructive">
                                {visibleState.fieldErrors.role}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="employee-phone">Telefone</Label>
                            <Input
                                id="employee-phone"
                                name="phone"
                                type="tel"
                                placeholder="Opcional"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="employee-email">Email</Label>
                            <Input
                                id="employee-email"
                                name="email"
                                type="email"
                                placeholder="Opcional"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="employee-license">Cédula profissional</Label>
                        <Input
                            id="employee-license"
                            name="professional_license_number"
                            placeholder="Opcional"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="employee-notes">Notas</Label>
                        <Textarea
                            id="employee-notes"
                            name="notes"
                            placeholder="Observações internas"
                        />
                    </div>

                    <Label className="flex h-9 items-center gap-2 rounded-md border px-3">
                        <input
                            type="checkbox"
                            name="active"
                            defaultChecked
                            className="size-4 rounded border-input accent-foreground"
                        />
                        Ativo
                    </Label>

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
