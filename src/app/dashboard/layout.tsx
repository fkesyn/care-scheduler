import { redirect } from "next/navigation";
import { connection } from "next/server";

import { logout } from "@/app/login/actions";
import { DashboardNav } from "@/app/dashboard/dashboard-nav";
import { Button } from "@/components/ui/button";
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

    return (
        <main className="min-h-full bg-background">
            <div className="border-b bg-card print:hidden">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-3">
                        <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                                Care Scheduler
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
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
