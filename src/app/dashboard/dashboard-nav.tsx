"use client";

import {
    BriefcaseMedicalIcon,
    CalendarDaysIcon,
    ClipboardListIcon,
    MapPinIcon,
    type LucideIcon,
    UsersRoundIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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
        href: "/dashboard/calendar/month",
        activeRoot: "/dashboard/calendar",
        label: "Calendário",
        icon: CalendarDaysIcon,
    },
];

export function DashboardNav() {
    const pathname = usePathname();

    return (
        <nav className="flex flex-wrap gap-2" aria-label="Dashboard">
            {items.map((item) => {
                const activeRoot = item.activeRoot ?? item.href;
                const isActive =
                    pathname === activeRoot || pathname.startsWith(`${activeRoot}/`);

                return (
                    <Button
                        key={item.href}
                        asChild
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                    >
                        <Link
                            href={item.href}
                            prefetch={false}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <DashboardNavItemContent
                                icon={item.icon}
                                label={item.label}
                            />
                        </Link>
                    </Button>
                );
            })}
        </nav>
    );
}

function DashboardNavItemContent({
    icon: Icon,
    label,
}: {
    icon: LucideIcon;
    label: string;
}) {
    const { pending } = useLinkStatus();

    return (
        <>
            {pending ? <Spinner /> : <Icon />}
            {label}
        </>
    );
}
