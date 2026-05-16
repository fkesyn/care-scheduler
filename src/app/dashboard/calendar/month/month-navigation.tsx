"use client";

import { useRouter } from "next/navigation";
import {
    createContext,
    type ComponentProps,
    type ReactNode,
    useContext,
    useMemo,
    useState,
    useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type MonthNavigationContextValue = {
    navigate: (href: string) => void;
    pending: boolean;
    pendingHref: string | null;
};

const MonthNavigationContext =
    createContext<MonthNavigationContextValue | null>(null);

export function MonthNavigationProvider({
    children,
    currentHref,
}: {
    children: ReactNode;
    currentHref: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const activePendingHref =
        pendingHref && pendingHref !== currentHref ? pendingHref : null;
    const pending = isPending || activePendingHref !== null;

    const value = useMemo<MonthNavigationContextValue>(
        () => ({
            navigate(href) {
                if (href === currentHref) {
                    return;
                }

                setPendingHref(href);

                window.requestAnimationFrame(() => {
                    startTransition(() => {
                        router.push(href, { scroll: false });
                    });
                });
            },
            pending,
            pendingHref: activePendingHref,
        }),
        [activePendingHref, currentHref, pending, router]
    );

    return (
        <MonthNavigationContext.Provider value={value}>
            <div className="relative">
                <div
                    className={cn(
                        "transition duration-200",
                        pending && "pointer-events-none opacity-45 saturate-75"
                    )}
                >
                    {children}
                </div>

                {pending ? (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center bg-background/35 pt-28 backdrop-blur-[1px]">
                        <div
                            className="flex items-center gap-2 rounded-md border bg-background px-4 py-3 text-sm font-medium shadow-sm"
                            role="status"
                        >
                            <Spinner />
                            A carregar calendário...
                        </div>
                    </div>
                ) : null}
            </div>
        </MonthNavigationContext.Provider>
    );
}

export function useMonthNavigation() {
    const context = useContext(MonthNavigationContext);

    if (!context) {
        throw new Error("useMonthNavigation must be used inside MonthNavigationProvider");
    }

    return context;
}

type MonthNavigationButtonProps = ComponentProps<typeof Button> & {
    href: string;
};

export function MonthNavigationButton({
    children,
    disabled,
    href,
    ...props
}: MonthNavigationButtonProps) {
    const { navigate, pending, pendingHref } = useMonthNavigation();
    const isCurrentButtonPending = pendingHref === href;

    return (
        <Button
            {...props}
            type="button"
            disabled={pending || disabled}
            onClick={() => navigate(href)}
        >
            {isCurrentButtonPending ? <Spinner /> : null}
            {children}
        </Button>
    );
}
