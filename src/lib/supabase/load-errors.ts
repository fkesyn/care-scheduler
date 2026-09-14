import type { PostgrestError } from "@supabase/supabase-js";

type SupabaseLoadResult<T> = {
    data: T | null;
    error: PostgrestError | null;
};

type RetryOptions = {
    retries?: number;
    retryDelayMs?: number;
};

function isRetryableSupabaseError(error: PostgrestError | null) {
    if (!error) {
        return false;
    }

    const message = error.message.toLowerCase();

    return (
        message.includes("bad gateway") ||
        message.includes("gateway timeout") ||
        message.includes("timeout") ||
        message.includes("network")
    );
}

function wait(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function loadSupabaseWithRetry<T>(
    scope: string,
    label: string,
    query: () => PromiseLike<SupabaseLoadResult<T>>,
    { retries = 1, retryDelayMs = 250 }: RetryOptions = {}
) {
    let result = await query();

    for (let attempt = 1; attempt <= retries; attempt++) {
        const retryableError = result.error;

        if (!retryableError || !isRetryableSupabaseError(retryableError)) {
            break;
        }

        console.warn(
            `[${scope}] Retrying ${label} after Supabase error: ${retryableError.message}`
        );

        await wait(retryDelayMs * attempt);
        result = await query();
    }

    logSupabaseLoadError(scope, label, result.error);

    return result;
}

export function logSupabaseLoadError(
    scope: string,
    label: string,
    error: PostgrestError | null
) {
    if (!error) {
        return;
    }

    console.error(`[${scope}] Failed to load ${label}`, {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
    });
}

export function formatSupabaseLoadError(label: string, error: PostgrestError) {
    return `${label}: ${error.message}`;
}
