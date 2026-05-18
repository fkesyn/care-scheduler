"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PatientProfileValues = {
    hasActiveWounds?: boolean | null;
    isDiabetic?: boolean | null;
    isHypertensive?: boolean | null;
};

type PatientProfileDropdownProps = {
    defaultValues?: PatientProfileValues;
};

const profileOptions = [
    {
        key: "isDiabetic",
        label: "Diabético",
        name: "is_diabetic",
    },
    {
        key: "isHypertensive",
        label: "Hipertenso",
        name: "is_hypertensive",
    },
    {
        key: "hasActiveWounds",
        label: "Feridas ativas",
        name: "has_active_wounds",
    },
] as const;

export function PatientProfileDropdown({
    defaultValues,
}: PatientProfileDropdownProps) {
    const menuId = useId();
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState({
        hasActiveWounds: Boolean(defaultValues?.hasActiveWounds),
        isDiabetic: Boolean(defaultValues?.isDiabetic),
        isHypertensive: Boolean(defaultValues?.isHypertensive),
    });

    const selectedLabels = profileOptions
        .filter((option) => selected[option.key])
        .map((option) => option.label);
    const summary =
        selectedLabels.length > 0 ? selectedLabels.join(", ") : "Sem perfil selecionado";

    return (
        <div className="relative grid min-w-0 gap-2">
            <Label htmlFor={`${menuId}-button`}>Perfil clínico</Label>
            <Button
                id={`${menuId}-button`}
                type="button"
                variant="outline"
                className="w-full min-w-0 justify-between"
                aria-controls={`${menuId}-menu`}
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
            >
                <span className="min-w-0 truncate text-left">{summary}</span>
                <ChevronDownIcon />
            </Button>

            {open ? (
                <div
                    id={`${menuId}-menu`}
                    className="absolute top-full z-50 mt-1 grid w-full min-w-0 gap-1 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg"
                >
                    {profileOptions.map((option) => (
                        <Label
                            key={option.name}
                            className={cn(
                                "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm leading-tight hover:bg-muted"
                            )}
                        >
                            <input
                                type="checkbox"
                                name={option.name}
                                checked={selected[option.key]}
                                className="size-4 shrink-0 rounded border-input accent-foreground"
                                onChange={(event) => {
                                    setSelected((current) => ({
                                        ...current,
                                        [option.key]: event.target.checked,
                                    }));
                                }}
                            />
                            <span className="min-w-0 break-words">{option.label}</span>
                        </Label>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
