"use client";

import { KeyRoundIcon, LogInIcon, MailIcon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    login,
    sendMagicLink,
    sendPasswordReset,
    type EmailAuthState,
    type LoginState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {
    status: "idle",
};

const emailAuthInitialState: EmailAuthState = {
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

function MagicLinkButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="outline" disabled={pending} className="w-full">
            <MailIcon />
            {pending ? "A enviar..." : "Enviar magic link"}
        </Button>
    );
}

function PasswordResetButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="outline" disabled={pending} className="w-full">
            <KeyRoundIcon />
            {pending ? "A enviar..." : "Recuperar password"}
        </Button>
    );
}

export function LoginForm({ next }: { next: string }) {
    const [state, formAction] = useActionState(login, initialState);
    const [magicLinkState, magicLinkAction] = useActionState(
        sendMagicLink,
        emailAuthInitialState
    );
    const [passwordResetState, passwordResetAction] = useActionState(
        sendPasswordReset,
        emailAuthInitialState
    );

    return (
        <div className="grid gap-5">
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

            <div className="grid gap-4 border-t pt-5">
                <form action={magicLinkAction} className="grid gap-3">
                    <input type="hidden" name="next" value={next} />
                    <div className="grid gap-2">
                        <Label htmlFor="magic-link-email">Magic link</Label>
                        <Input
                            id="magic-link-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="email@exemplo.com"
                            required
                        />
                    </div>
                    {magicLinkState.message ? (
                        <p
                            className={
                                magicLinkState.status === "error"
                                    ? "text-sm text-destructive"
                                    : "text-sm text-muted-foreground"
                            }
                            role={
                                magicLinkState.status === "error"
                                    ? "alert"
                                    : "status"
                            }
                        >
                            {magicLinkState.message}
                        </p>
                    ) : null}
                    <MagicLinkButton />
                </form>

                <form action={passwordResetAction} className="grid gap-3">
                    <div className="grid gap-2">
                        <Label htmlFor="password-reset-email">
                            Recuperar password
                        </Label>
                        <Input
                            id="password-reset-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="email@exemplo.com"
                            required
                        />
                    </div>
                    {passwordResetState.message ? (
                        <p
                            className={
                                passwordResetState.status === "error"
                                    ? "text-sm text-destructive"
                                    : "text-sm text-muted-foreground"
                            }
                            role={
                                passwordResetState.status === "error"
                                    ? "alert"
                                    : "status"
                            }
                        >
                            {passwordResetState.message}
                        </p>
                    ) : null}
                    <PasswordResetButton />
                </form>
            </div>
        </div>
    );
}
