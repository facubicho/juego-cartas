export const usd = (n: number, decimales = 4) =>
  "US$ " + n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

export const fecha = (iso: string | Date | null) =>
  iso
    ? new Date(iso).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "sin fecha";
