import { Spinner } from "@/components/ui/spinner";

export default function DashboardLoading() {
    return (
        <div className="px-6 py-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                <div
                    className="flex min-h-72 items-center justify-center rounded-lg border bg-card shadow-xs"
                    role="status"
                    aria-live="polite"
                >
                    <div className="flex flex-col items-center gap-4 px-6 text-center">
                        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Spinner className="size-6" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">
                                A carregar
                            </p>
                            <p className="text-xs text-muted-foreground">
                                A preparar a vista...
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
