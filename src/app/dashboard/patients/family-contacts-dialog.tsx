"use client";

import { ContactRoundIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
    createFamilyContact,
    deleteFamilyContact,
    type DeleteFamilyContactState,
    type FamilyContactState,
    updateFamilyContact,
} from "@/app/dashboard/patients/actions";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FamilyContact = {
    id: string;
    patient_id: string;
    name: string;
    relationship: string;
    contact: string;
};

type FamilyContactsDialogProps = {
    canManage: boolean;
    contacts: FamilyContact[];
    patientId: string;
    patientName: string;
};

const contactInitialState: FamilyContactState = {
    status: "idle",
};

const deleteInitialState: DeleteFamilyContactState = {
    status: "idle",
};

function SaveContactButton({ children }: { children: string }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : children}
        </Button>
    );
}

function DeleteContactButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            <Trash2Icon />
            {pending ? "A apagar..." : "Apagar"}
        </Button>
    );
}

function CreateContactForm({ patientId }: { patientId: string }) {
    const [state, formAction] = useActionState(
        createFamilyContact,
        contactInitialState
    );
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.status === "success") {
            formRef.current?.reset();
        }
    }, [state.status]);

    return (
        <form ref={formRef} action={formAction} className="grid gap-4 rounded-lg border p-4">
            <input type="hidden" name="patient_id" value={patientId} />

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                    <Label htmlFor={`family-contact-name-${patientId}`}>Nome</Label>
                    <Input
                        id={`family-contact-name-${patientId}`}
                        name="name"
                        aria-invalid={Boolean(state.fieldErrors?.name)}
                        required
                    />
                    {state.fieldErrors?.name ? (
                        <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
                    ) : null}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`family-contact-relationship-${patientId}`}>
                        Parentesco
                    </Label>
                    <Input
                        id={`family-contact-relationship-${patientId}`}
                        name="relationship"
                        placeholder="Ex.: filha"
                        aria-invalid={Boolean(state.fieldErrors?.relationship)}
                        required
                    />
                    {state.fieldErrors?.relationship ? (
                        <p className="text-sm text-destructive">
                            {state.fieldErrors.relationship}
                        </p>
                    ) : null}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`family-contact-contact-${patientId}`}>
                        Contacto
                    </Label>
                    <Input
                        id={`family-contact-contact-${patientId}`}
                        name="contact"
                        aria-invalid={Boolean(state.fieldErrors?.contact)}
                        required
                    />
                    {state.fieldErrors?.contact ? (
                        <p className="text-sm text-destructive">
                            {state.fieldErrors.contact}
                        </p>
                    ) : null}
                </div>
            </div>

            {state.message ? (
                <p
                    className={cn(
                        "text-sm",
                        state.status === "error"
                            ? "text-destructive"
                            : "text-muted-foreground"
                    )}
                    role={state.status === "error" ? "alert" : "status"}
                >
                    {state.message}
                </p>
            ) : null}

            <DialogFooter>
                <SaveContactButton>Criar contacto</SaveContactButton>
            </DialogFooter>
        </form>
    );
}

function FamilyContactCard({
    canManage,
    contact,
}: {
    canManage: boolean;
    contact: FamilyContact;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [updateState, updateAction] = useActionState(
        updateFamilyContact,
        contactInitialState
    );
    const [deleteState, deleteAction] = useActionState(
        deleteFamilyContact,
        deleteInitialState
    );

    if (deleteState.status === "success") {
        return (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                {deleteState.message}
            </p>
        );
    }

    if (isEditing) {
        return (
            <form action={updateAction} className="grid gap-4 rounded-lg border p-4">
                <input type="hidden" name="id" value={contact.id} />
                <input type="hidden" name="patient_id" value={contact.patient_id} />

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                        <Label htmlFor={`family-contact-name-${contact.id}`}>Nome</Label>
                        <Input
                            id={`family-contact-name-${contact.id}`}
                            name="name"
                            defaultValue={contact.name}
                            aria-invalid={Boolean(updateState.fieldErrors?.name)}
                            required
                        />
                        {updateState.fieldErrors?.name ? (
                            <p className="text-sm text-destructive">
                                {updateState.fieldErrors.name}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`family-contact-relationship-${contact.id}`}>
                            Parentesco
                        </Label>
                        <Input
                            id={`family-contact-relationship-${contact.id}`}
                            name="relationship"
                            defaultValue={contact.relationship}
                            aria-invalid={Boolean(updateState.fieldErrors?.relationship)}
                            required
                        />
                        {updateState.fieldErrors?.relationship ? (
                            <p className="text-sm text-destructive">
                                {updateState.fieldErrors.relationship}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`family-contact-contact-${contact.id}`}>
                            Contacto
                        </Label>
                        <Input
                            id={`family-contact-contact-${contact.id}`}
                            name="contact"
                            defaultValue={contact.contact}
                            aria-invalid={Boolean(updateState.fieldErrors?.contact)}
                            required
                        />
                        {updateState.fieldErrors?.contact ? (
                            <p className="text-sm text-destructive">
                                {updateState.fieldErrors.contact}
                            </p>
                        ) : null}
                    </div>
                </div>

                {updateState.message ? (
                    <p
                        className={cn(
                            "text-sm",
                            updateState.status === "error"
                                ? "text-destructive"
                                : "text-muted-foreground"
                        )}
                        role={updateState.status === "error" ? "alert" : "status"}
                    >
                        {updateState.message}
                    </p>
                ) : null}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                        Cancelar
                    </Button>
                    <SaveContactButton>Guardar</SaveContactButton>
                </DialogFooter>
            </form>
        );
    }

    return (
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
                <p className="truncate font-medium">{contact.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                    {contact.relationship} · {contact.contact}
                </p>
            </div>

            {canManage ? (
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                    >
                        <PencilIcon />
                        Editar
                    </Button>
                    <form action={deleteAction}>
                        <input type="hidden" name="id" value={contact.id} />
                        <input
                            type="hidden"
                            name="patient_id"
                            value={contact.patient_id}
                        />
                        <DeleteContactButton />
                    </form>
                </div>
            ) : null}

            {deleteState.message ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                    {deleteState.message}
                </p>
            ) : null}
        </div>
    );
}

export function FamilyContactsDialog({
    canManage,
    contacts,
    patientId,
    patientName,
}: FamilyContactsDialogProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="Contactos familiares">
                    <ContactRoundIcon />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Contactos familiares</DialogTitle>
                    <DialogDescription>{patientName}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-5">
                    {canManage ? <CreateContactForm patientId={patientId} /> : null}

                    <div className="grid gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-medium">Contactos registados</h3>
                            <span className="text-xs text-muted-foreground">
                                {contacts.length}
                            </span>
                        </div>

                        {contacts.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                Sem contactos familiares registados.
                            </div>
                        ) : (
                            contacts.map((contact) => (
                                <FamilyContactCard
                                    key={contact.id}
                                    canManage={canManage}
                                    contact={contact}
                                />
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
