"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    deleteLocation,
    type DeleteLocationState,
    updateLocation,
    type UpdateLocationState,
} from "@/app/dashboard/locations/actions";
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

type Location = {
    id: string;
    name: string;
    active: boolean | null;
};

type LocationRowActionsProps = {
    location: Location;
};

const updateInitialState: UpdateLocationState = {
    status: "idle",
};

const deleteInitialState: DeleteLocationState = {
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
            {pending ? "A apagar..." : "Apagar local"}
        </Button>
    );
}

export function LocationRowActions({ location }: LocationRowActionsProps) {
    const [updateState, updateAction] = useActionState(
        updateLocation,
        updateInitialState
    );
    const [deleteState, deleteAction] = useActionState(
        deleteLocation,
        deleteInitialState
    );
    const updateDialog = useActionDialog(updateState, updateInitialState);
    const deleteDialog = useActionDialog(deleteState, deleteInitialState);

    return (
        <div className="flex justify-end gap-2">
            <Dialog open={updateDialog.open} onOpenChange={updateDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Editar local">
                        <PencilIcon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar local</DialogTitle>
                        <DialogDescription>
                            Atualiza o nome e estado deste local.
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
                            <input type="hidden" name="id" value={location.id} />

                            <div className="grid gap-2">
                                <Label htmlFor={`location-name-${location.id}`}>
                                    Nome
                                </Label>
                                <Input
                                    id={`location-name-${location.id}`}
                                    name="name"
                                    defaultValue={location.name}
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

                            <Label className="flex h-9 items-center gap-2 rounded-md border px-3">
                                <input
                                    type="checkbox"
                                    name="active"
                                    defaultChecked={Boolean(location.active)}
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
                    <Button size="icon-sm" variant="ghost" aria-label="Apagar local">
                        <Trash2Icon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apagar local</DialogTitle>
                        <DialogDescription>
                            Esta ação apaga definitivamente este local.
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
                            <input type="hidden" name="id" value={location.id} />
                            <p className="text-sm text-muted-foreground">
                                Vais apagar <strong>{location.name}</strong>. Se ainda
                                houver dados ligados, a base de dados pode bloquear.
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
