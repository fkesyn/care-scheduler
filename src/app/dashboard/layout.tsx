import { redirect } from "next/navigation";
import { connection } from "next/server";

import { logout } from "@/app/login/actions";
import { DashboardNav } from "@/app/dashboard/dashboard-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUserRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    await connection();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login?next=/dashboard/locations");
    }

    const role = await getCurrentUserRole();

    return (
        <main className="min-h-full bg-background">
            <div className="border-b bg-card print:hidden">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-3">
                        <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                                Care Scheduler
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <p className="text-sm text-muted-foreground">
                                    {user.email}
                                </p>
                                <Badge variant={role === "admin" ? "secondary" : "outline"}>
                                    {role === "admin" ? "Admin" : "Consulta"}
                                </Badge>
                            </div>
                        </div>
                        <DashboardNav />
                    </div>

                    <form action={logout}>
                        <Button variant="outline" type="submit">
                            Terminar sessão
                        </Button>
                    </form>
                </div>
            </div>

            {children}
        </main>
    );
}
