"use client";

import { CalendarDaysIcon } from "lucide-react";
import { FormEvent, useState } from "react";

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
import { useMonthNavigation } from "./month-navigation";

type MonthPickerDialogProps = {
    label: string;
    selectedDate: string;
    selectedEmployeeId: string;
    selectedLocationId: string;
    selectedPatientId: string;
    selectedServiceId: string;
};

function todayMonthValue() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthHref(
    monthValue: string,
    filters: {
        employeeId: string;
        locationId: string;
        patientId: string;
        serviceId: string;
    }
) {
    const query = new URLSearchParams();

    query.set("date", `${monthValue}-01`);

    if (filters.locationId) query.set("locationId", filters.locationId);
    if (filters.employeeId) query.set("employeeId", filters.employeeId);
    if (filters.patientId) query.set("patientId", filters.patientId);
    if (filters.serviceId) query.set("serviceId", filters.serviceId);

    return `/dashboard/calendar/month?${query.toString()}`;
}

export function MonthPickerDialog({
    label,
    selectedDate,
    selectedEmployeeId,
    selectedLocationId,
    selectedPatientId,
    selectedServiceId,
}: MonthPickerDialogProps) {
    const { navigate, pending } = useMonthNavigation();
    const [open, setOpen] = useState(false);
    const [monthValue, setMonthValue] = useState(selectedDate.slice(0, 7));
    const filters = {
        employeeId: selectedEmployeeId,
        locationId: selectedLocationId,
        patientId: selectedPatientId,
        serviceId: selectedServiceId,
    };

    function navigateToMonth(nextMonthValue: string) {
        setOpen(false);
        navigate(buildMonthHref(nextMonthValue, filters));
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!monthValue) {
            return;
        }

        navigateToMonth(monthValue);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" size="sm" variant="secondary" disabled={pending}>
                    {pending ? <Spinner /> : <CalendarDaysIcon />}
                    <span className="capitalize">{label}</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Escolher mês</DialogTitle>
                    <DialogDescription>
                        Salta diretamente para o mês que queres ver no calendário.
                    </DialogDescription>
                </DialogHeader>

                <form className="grid gap-4" onSubmit={handleSubmit}>
                    <div className="grid gap-2">
                        <Label htmlFor="calendar-month-picker">Mês</Label>
                        <Input
                            id="calendar-month-picker"
                            type="month"
                            value={monthValue}
                            onChange={(event) => setMonthValue(event.target.value)}
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigateToMonth(todayMonthValue())}
                        >
                            Este mês
                        </Button>
                        <Button type="submit">Ver mês</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
