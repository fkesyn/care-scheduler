"use client";

import { useCallback, useState } from "react";

type ActionDialogState = {
    status: "idle" | "success" | "error";
};

export function useActionDialog<TState extends ActionDialogState>(
    state: TState,
    initialState: TState
) {
    const [open, setOpenValue] = useState(false);
    const [dismissedState, setDismissedState] = useState<TState | null>(null);
    const visibleState = state === dismissedState ? initialState : state;

    const setOpen = useCallback(
        (nextOpen: boolean) => {
            setOpenValue(nextOpen);

            if (!nextOpen) {
                setDismissedState(state);
            }
        },
        [state]
    );

    const closeDialog = useCallback(() => {
        setOpen(false);
    }, [setOpen]);

    const showFormAgain = useCallback(() => {
        setDismissedState(state);
        setOpenValue(true);
    }, [state]);

    return {
        closeDialog,
        open,
        setOpen,
        showFormAgain,
        visibleState,
    };
}
