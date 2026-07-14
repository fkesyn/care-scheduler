export function calendarServiceLabel(
    serviceName: string | null | undefined,
    fallback = "Serviço"
) {
    const name = serviceName?.trim();

    if (!name) {
        return fallback;
    }

    const normalizedName = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-PT");

    if (
        normalizedName === "ta" ||
        normalizedName.includes("tensao arterial") ||
        normalizedName.includes("pressao arterial")
    ) {
        return "TA";
    }

    return name;
}
