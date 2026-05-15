"use client";

import { LogInIcon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {
    status: "idle",
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending} className="w-full">
            <LogInIcon />
            {pending ? "A entrar..." : "Entrar"}
        </Button>
    );
}

export function LoginForm({ next }: { next: string }) {
    const [state, formAction] = useActionState(login, initialState);

    return (
        <form action={formAction} className="grid gap-4">
            <input type="hidden" name="next" value={next} />

            <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                />
            </div>

            {state.message ? (
                <p className="text-sm text-destructive" role="alert">
                    {state.message}
                </p>
            ) : null}

            <SubmitButton />
        </form>
    );
}
