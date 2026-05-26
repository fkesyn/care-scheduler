"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MonthNavigationControlsProps = {
    selectedMonth: string;
};

function shiftMonth(monthValue: string, delta: number) {
    const [year, month] = monthValue.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + delta);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthNavigationControls({
    selectedMonth,
}: MonthNavigationControlsProps) {
    const router = useRouter();

    function navigateToMonth(nextMonth: string) {
        router.push(`/dashboard/schedules?month=${nextMonth}`);
    }

    return (
        <section className="rounded-lg border bg-card p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="grid gap-2">
                    <Label htmlFor="schedule-month-filter">Mês</Label>
                    <Input
                        id="schedule-month-filter"
                        name="month"
                        type="month"
                        value={selectedMonth}
                        onChange={(event) => navigateToMonth(event.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigateToMonth(shiftMonth(selectedMonth, -1))}
                    >
                        <ChevronLeftIcon />
                        Mês anterior
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigateToMonth(shiftMonth(selectedMonth, 1))}
                    >
                        Mês seguinte
                        <ChevronRightIcon />
                    </Button>
                </div>
            </div>
        </section>
    );
}
