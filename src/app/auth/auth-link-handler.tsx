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

type AuthLinkHandlerProps = {
    defaultPath?: string;
    fallbackPath?: string;
    title?: string;
};

function safePath(path: string | null | undefined, fallback: string) {
    if (path && path.startsWith("/") && !path.startsWith("//")) {
        return path;
    }

    return fallback;
}

function destinationForAuthLink(
    next: string | null,
    authType: string | null,
    defaultPath: string
) {
    if (authType === "recovery") {
        return "/update-password";
    }

    return safePath(next, defaultPath);
}

function getAuthLinkParams() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
        window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash
    );

    return {
        accessToken: hashParams.get("access_token"),
        code: searchParams.get("code") ?? hashParams.get("code"),
        error:
            searchParams.get("error_description") ??
            hashParams.get("error_description") ??
            searchParams.get("error") ??
            hashParams.get("error"),
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

export function AuthLinkHandler({
    defaultPath = "/dashboard/locations",
    fallbackPath = "/login",
    title = "A confirmar acesso",
}: AuthLinkHandlerProps) {
    const router = useRouter();
    const [message, setMessage] = useState("A confirmar o link...");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function confirmAuthLink() {
            const {
                accessToken,
                code,
                error,
                next,
                refreshToken,
                tokenHash,
                type,
            } = getAuthLinkParams();
            const destination = destinationForAuthLink(next, type, defaultPath);
            const hasLinkPayload =
                Boolean(code) ||
                Boolean(tokenHash) ||
                Boolean(accessToken && refreshToken);

            if (error) {
                throw new Error(error);
            }

            if (isMounted) {
                setMessage(
                    hasLinkPayload
                        ? "A criar sessão..."
                        : "A verificar sessão..."
                );
            }

            const supabase = createClient();

            if (code) {
                const { error: exchangeError } =
                    await supabase.auth.exchangeCodeForSession(code);

                if (exchangeError) {
                    throw exchangeError;
                }

                router.replace(destination);
                return;
            }

            if (tokenHash && isEmailOtpType(type)) {
                const { error: verifyError } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type,
                });

                if (verifyError) {
                    throw verifyError;
                }

                router.replace(destination);
                return;
            }

            if (accessToken && refreshToken) {
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (sessionError) {
                    throw sessionError;
                }

                router.replace(destination);
                return;
            }

            const {
                data: { session },
                error: sessionLookupError,
            } = await supabase.auth.getSession();

            if (sessionLookupError) {
                throw sessionLookupError;
            }

            router.replace(session ? defaultPath : fallbackPath);
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
    }, [defaultPath, fallbackPath, router]);

    return (
        <main className="flex min-h-full items-center justify-center bg-background p-6">
            <section className="grid w-full max-w-sm gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
                <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
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
