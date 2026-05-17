"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
    createLocation,
    type CreateLocationState,
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

const initialState: CreateLocationState = {
    status: "idle",
};
const defaultLocationColor = "#0f766e";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : "Criar local"}
        </Button>
    );
}

export function NewLocationDialog() {
    const [state, formAction] = useActionState(createLocation, initialState);
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
                    Novo local
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Novo local</DialogTitle>
                    <DialogDescription>
                        Cria uma unidade/local para organizar utentes e agendamentos.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleState.message ?? "Local criado com sucesso."}
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Criar outro local
                            </Button>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                <form ref={formRef} action={formAction} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="location-name">Nome</Label>
                        <Input
                            id="location-name"
                            name="name"
                            placeholder="Ex.: S. Francisco"
                            aria-describedby={
                                visibleState.fieldErrors?.name
                                    ? "location-name-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.name)}
                            required
                        />
                        {visibleState.fieldErrors?.name ? (
                            <p id="location-name-error" className="text-sm text-destructive">
                                {visibleState.fieldErrors.name}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="location-color">Cor</Label>
                        <div className="flex items-center gap-3">
                            <input
                                id="location-color"
                                name="color"
                                type="color"
                                defaultValue={defaultLocationColor}
                                className="h-10 w-14 rounded-md border border-input bg-background p-1 shadow-xs"
                                aria-describedby={
                                    visibleState.fieldErrors?.color
                                        ? "location-color-error"
                                        : undefined
                                }
                                aria-invalid={Boolean(visibleState.fieldErrors?.color)}
                            />
                        </div>
                        {visibleState.fieldErrors?.color ? (
                            <p id="location-color-error" className="text-sm text-destructive">
                                {visibleState.fieldErrors.color}
                            </p>
                        ) : null}
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
                        <SubmitButton />
                    </DialogFooter>
                </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
