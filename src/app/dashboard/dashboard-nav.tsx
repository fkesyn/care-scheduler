"use client";

import {
    BriefcaseMedicalIcon,
    CalendarDaysIcon,
    ClipboardListIcon,
    MapPinIcon,
    UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const items = [
    {
        href: "/dashboard/locations",
        label: "Locais",
        icon: MapPinIcon,
    },
    {
        href: "/dashboard/patients",
        label: "Utentes",
        icon: UsersRoundIcon,
    },
    {
        href: "/dashboard/employees",
        label: "Equipa",
        icon: BriefcaseMedicalIcon,
    },
    {
        href: "/dashboard/services",
        label: "Serviços",
        icon: ClipboardListIcon,
    },
    {
        href: "/dashboard/calendar",
        label: "Calendário",
        icon: CalendarDaysIcon,
    },
];

export function DashboardNav() {
    const pathname = usePathname();

    return (
        <nav className="flex flex-wrap gap-2" aria-label="Dashboard">
            {items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                    <Button
                        key={item.href}
                        asChild
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                    >
                        <Link href={item.href}>
                            <Icon />
                            {item.label}
                        </Link>
                    </Button>
                );
            })}
        </nav>
    );
}
