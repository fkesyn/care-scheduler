import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables");
}

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet, headers) {
                cookiesToSet.forEach(({ name, value }) => {
                    request.cookies.set(name, value);
                });

                supabaseResponse = NextResponse.next({
                    request,
                });

                cookiesToSet.forEach(({ name, value, options }) => {
                    supabaseResponse.cookies.set(name, value, options);
                });

                Object.entries(headers).forEach(([key, value]) => {
                    supabaseResponse.headers.set(key, value);
                });
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set(
            "next",
            `${request.nextUrl.pathname}${request.nextUrl.search}`
        );

        return NextResponse.redirect(url);
    }

    if (user && request.nextUrl.pathname === "/login") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/locations";
        url.search = "";

        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
