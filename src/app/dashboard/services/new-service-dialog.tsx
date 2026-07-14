"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
    createService,
    type CreateServiceState,
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

const initialState: CreateServiceState = {
    status: "idle",
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : "Criar serviço"}
        </Button>
    );
}

export function NewServiceDialog() {
    const [state, formAction] = useActionState(createService, initialState);
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
                    Novo serviço
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Novo serviço</DialogTitle>
                    <DialogDescription>
                        Define os serviços usados no calendário e nos registos clínicos.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleState.message ?? "Serviço criado com sucesso."}
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Criar outro serviço
                            </Button>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                <form ref={formRef} action={formAction} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="service-name">Nome</Label>
                        <Input
                            id="service-name"
                            name="name"
                            placeholder="Ex.: Avaliação de glicémia"
                            aria-describedby={
                                visibleState.fieldErrors?.name
                                    ? "service-name-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.name)}
                            required
                        />
                        {visibleState.fieldErrors?.name ? (
                            <p id="service-name-error" className="text-sm text-destructive">
                                {visibleState.fieldErrors.name}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="service-duration">Duração em minutos</Label>
                        <Input
                            id="service-duration"
                            name="duration_minutes"
                            type="number"
                            min={1}
                            max={480}
                            defaultValue={30}
                            aria-describedby={
                                visibleState.fieldErrors?.durationMinutes
                                    ? "service-duration-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(
                                visibleState.fieldErrors?.durationMinutes
                            )}
                            required
                        />
                        {visibleState.fieldErrors?.durationMinutes ? (
                            <p
                                id="service-duration-error"
                                className="text-sm text-destructive"
                            >
                                {visibleState.fieldErrors.durationMinutes}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="service-measurement">Registo associado</Label>
                        <select
                            id="service-measurement"
                            name="measurement_type"
                            defaultValue=""
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            <option value="">Sem medição</option>
                            <option value="blood_pressure">Tensão arterial</option>
                            <option value="glucose">Glicémia</option>
                            <option value="wound_care">Tratamento de feridas</option>
                        </select>
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
