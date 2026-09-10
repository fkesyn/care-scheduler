"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const emailOtpTypes = new Set([
    "signup",
    "invite",
    "magiclink",
    "recovery",
    "email_change",
    "email",
]);

function safeNextPath(next: string | null, authType: string | null) {
    if (next && next.startsWith("/") && !next.startsWith("//")) {
        return next;
    }

    if (authType === "recovery") {
        return "/update-password";
    }

    return "/dashboard/locations";
}

function getCallbackParams() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
        window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash
    );

    return {
        accessToken: hashParams.get("access_token"),
        code: searchParams.get("code") ?? hashParams.get("code"),
        next: searchParams.get("next") ?? hashParams.get("next"),
        refreshToken: hashParams.get("refresh_token"),
        tokenHash:
            searchParams.get("token_hash") ?? hashParams.get("token_hash"),
        type: searchParams.get("type") ?? hashParams.get("type"),
    };
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
    return Boolean(value && emailOtpTypes.has(value));
}

export default function AuthCallbackPage() {
    const router = useRouter();
    const [message, setMessage] = useState("A confirmar o link...");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function confirmAuthLink() {
            const supabase = createClient();
            const {
                accessToken,
                code,
                next,
                refreshToken,
                tokenHash,
                type,
            } = getCallbackParams();
            const destination = safeNextPath(next, type);

            if (isMounted) {
                setMessage("A criar sessão...");
            }

            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);

                if (error) {
                    throw error;
                }

                router.replace(destination);
                return;
            }

            if (tokenHash && isEmailOtpType(type)) {
                const { error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type,
                });

                if (error) {
                    throw error;
                }

                router.replace(destination);
                return;
            }

            if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (error) {
                    throw error;
                }

                router.replace(destination);
                return;
            }

            const {
                data: { session },
                error,
            } = await supabase.auth.getSession();

            if (error) {
                throw error;
            }

            if (!session) {
                throw new Error("O link não trouxe um código de autenticação válido.");
            }

            router.replace(destination);
        }

        confirmAuthLink().catch((error: unknown) => {
            if (!isMounted) {
                return;
            }

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Não consegui confirmar este link."
            );
        });

        return () => {
            isMounted = false;
        };
    }, [router]);

    return (
        <main className="flex min-h-full items-center justify-center bg-background p-6">
            <section className="grid w-full max-w-sm gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
                <h1 className="text-xl font-semibold tracking-tight">
                    A confirmar acesso
                </h1>
                {errorMessage ? (
                    <p className="text-sm text-destructive" role="alert">
                        {errorMessage}
                    </p>
                ) : (
                    <p className="text-sm text-muted-foreground" role="status">
                        {message}
                    </p>
                )}
            </section>
        </main>
    );
}
