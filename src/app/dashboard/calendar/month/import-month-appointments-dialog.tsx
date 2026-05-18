"use client";

import { UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

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
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ImportResponse = {
    status: "success" | "error";
    message: string;
    errors?: string[];
    counts?: {
        apagadas: number;
        atualizadas: number;
        criadas: number;
        duplicadasIgnoradas: number;
        ignoradas: number;
    };
};

export function ImportMonthAppointmentsDialog() {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [result, setResult] = useState<ImportResponse | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPending(true);
        setResult(null);

        const formData = new FormData(event.currentTarget);

        try {
            const response = await fetch("/dashboard/calendar/month/import", {
                body: formData,
                method: "POST",
            });
            const payload = (await response.json()) as ImportResponse;

            setResult(payload);

            if (response.ok && payload.status === "success") {
                formRef.current?.reset();
                router.refresh();
            }
        } catch {
            setResult({
                message: "Não consegui enviar o ficheiro. Tenta novamente.",
                status: "error",
            });
        } finally {
            setPending(false);
        }
    }

    function closeDialog() {
        setOpen(false);
        setResult(null);
        formRef.current?.reset();
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <UploadIcon />
                    Importar Excel
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Importar calendário</DialogTitle>
                    <DialogDescription>
                        Usa o ficheiro exportado nesta vista para criar, atualizar ou
                        apagar marcações.
                    </DialogDescription>
                </DialogHeader>

                <form ref={formRef} className="grid gap-4" onSubmit={handleSubmit}>
                    <div className="grid gap-2">
                        <Label htmlFor="month-import-file">Ficheiro Excel</Label>
                        <Input
                            id="month-import-file"
                            name="file"
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            disabled={pending}
                            required
                        />
                    </div>

                    {result ? (
                        <div
                            className={cn(
                                "grid gap-2 rounded-md border p-3 text-sm",
                                result.status === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                                    : "border-destructive/30 bg-destructive/5 text-destructive"
                            )}
                            role={result.status === "error" ? "alert" : "status"}
                        >
                            <p>{result.message}</p>
                            {result.counts ? (
                                <p>
                                    Criadas: {result.counts.criadas} · Atualizadas:{" "}
                                    {result.counts.atualizadas} · Apagadas:{" "}
                                    {result.counts.apagadas} · Duplicadas ignoradas:{" "}
                                    {result.counts.duplicadasIgnoradas}
                                </p>
                            ) : null}
                            {result.errors?.length ? (
                                <ul className="grid gap-1">
                                    {result.errors.slice(0, 8).map((error) => (
                                        <li key={error}>{error}</li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeDialog}
                            disabled={pending}
                        >
                            Fechar
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending ? (
                                <>
                                    <Spinner />
                                    A importar...
                                </>
                            ) : (
                                "Importar"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
