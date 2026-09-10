"use client";

import { KeyRoundIcon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    updatePassword,
    type UpdatePasswordState,
} from "@/app/update-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: UpdatePasswordState = {
    status: "idle",
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending} className="w-full">
            <KeyRoundIcon />
            {pending ? "A guardar..." : "Guardar nova password"}
        </Button>
    );
}

export function UpdatePasswordForm() {
    const [state, formAction] = useActionState(updatePassword, initialState);

    return (
        <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="password">Nova password</Label>
                <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirmar password</Label>
                <Input
                    id="confirm-password"
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
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
