import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
    searchParams: Promise<{
        next?: string;
    }>;
};

function safeNextPath(next?: string) {
    if (!next || !next.startsWith("/") || next.startsWith("//")) {
        return "/dashboard/locations";
    }

    return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const { next } = await searchParams;
    const redirectTo = safeNextPath(next);
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        redirect(redirectTo);
    }

    return (
        <main className="flex min-h-full items-center justify-center bg-background p-6">
            <section className="grid w-full max-w-sm gap-6 rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
                <header className="grid gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
                    <p className="text-sm text-muted-foreground">
                        Usa a conta Supabase para aceder ao dashboard.
                    </p>
                </header>

                <LoginForm next={redirectTo} />
            </section>
        </main>
    );
}
