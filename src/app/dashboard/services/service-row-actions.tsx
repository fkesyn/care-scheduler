"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    deleteService,
    type DeleteServiceState,
    updateService,
    type UpdateServiceState,
} from "@/app/dashboard/services/actions";
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

type Service = {
    id: string;
    name: string;
    duration_minutes: number | null;
    measurement_type: string | null;
    active: boolean | null;
};

type ServiceRowActionsProps = {
    service: Service;
};

const updateInitialState: UpdateServiceState = {
    status: "idle",
};

const deleteInitialState: DeleteServiceState = {
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
            {pending ? "A apagar..." : "Apagar serviço"}
        </Button>
    );
}

export function ServiceRowActions({ service }: ServiceRowActionsProps) {
    const [updateState, updateAction] = useActionState(
        updateService,
        updateInitialState
    );
    const [deleteState, deleteAction] = useActionState(
        deleteService,
        deleteInitialState
    );
    const updateDialog = useActionDialog(updateState, updateInitialState);
    const deleteDialog = useActionDialog(deleteState, deleteInitialState);

    return (
        <div className="flex justify-end gap-2">
            <Dialog open={updateDialog.open} onOpenChange={updateDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Editar serviço">
                        <PencilIcon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar serviço</DialogTitle>
                        <DialogDescription>
                            Atualiza duração, registo associado e estado.
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
                            <input type="hidden" name="id" value={service.id} />

                            <div className="grid gap-2">
                                <Label htmlFor={`service-name-${service.id}`}>
                                    Nome
                                </Label>
                                <Input
                                    id={`service-name-${service.id}`}
                                    name="name"
                                    defaultValue={service.name}
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
                                <Label htmlFor={`service-duration-${service.id}`}>
                                    Duração em minutos
                                </Label>
                                <Input
                                    id={`service-duration-${service.id}`}
                                    name="duration_minutes"
                                    type="number"
                                    min={1}
                                    max={480}
                                    defaultValue={service.duration_minutes ?? 30}
                                    aria-invalid={Boolean(
                                        updateDialog.visibleState.fieldErrors
                                            ?.durationMinutes
                                    )}
                                    required
                                />
                                {updateDialog.visibleState.fieldErrors
                                    ?.durationMinutes ? (
                                    <p className="text-sm text-destructive">
                                        {
                                            updateDialog.visibleState.fieldErrors
                                                .durationMinutes
                                        }
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`service-measurement-${service.id}`}>
                                    Registo associado
                                </Label>
                                <select
                                    id={`service-measurement-${service.id}`}
                                    name="measurement_type"
                                    defaultValue={service.measurement_type ?? ""}
                                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                    <option value="">Sem medição</option>
                                    <option value="blood_pressure">Tensão arterial</option>
                                    <option value="glucose">Glicémia</option>
                                </select>
                            </div>

                            <Label className="flex h-9 items-center gap-2 rounded-md border px-3">
                                <input
                                    type="checkbox"
                                    name="active"
                                    defaultChecked={Boolean(service.active)}
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
                    <Button size="icon-sm" variant="ghost" aria-label="Apagar serviço">
                        <Trash2Icon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apagar serviço</DialogTitle>
                        <DialogDescription>
                            Esta ação apaga definitivamente este serviço.
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
                            <input type="hidden" name="id" value={service.id} />
                            <p className="text-sm text-muted-foreground">
                                Vais apagar <strong>{service.name}</strong>. As
                                marcações associadas a este serviço também serão apagadas.
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
