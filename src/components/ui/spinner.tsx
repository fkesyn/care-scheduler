import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = {
    className?: string;
};

export function Spinner({ className }: SpinnerProps) {
    return (
        <LoaderCircleIcon
            className={cn("size-4 animate-spin", className)}
            aria-hidden="true"
        />
    );
}
