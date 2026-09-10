import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/app/update-password/update-password-form";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <main className="flex min-h-full items-center justify-center bg-background p-6">
            <section className="grid w-full max-w-sm gap-6 rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
                <header className="grid gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Nova password
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Escolhe uma nova password para a tua conta.
                    </p>
                </header>

                <UpdatePasswordForm />
            </section>
        </main>
    );
}
