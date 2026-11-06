// Formato de números y fechas en español. Sin nada de diseño.

export const pct = (p: number | null | undefined) => (p === null || p === undefined ? '–' : `${Math.round(p * 100)}%`);
export const dec = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined ? '–' : x.toFixed(digits).replace('.', ',');

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const longDate = (d: Date) => {
  const s = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  return s[0].toUpperCase() + s.slice(1);
};

/** Días del selector: ayer, hoy y los 5 siguientes (en la hora del móvil). */
export function dayOptions(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return [-1, 0, 1, 2, 3, 4, 5].map((offset) => {
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 1);
    const label = offset === -1 ? 'Ayer' : offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : `${WEEKDAYS[from.getDay()]} ${from.getDate()}`;
    return { offset, label, from, to };
  });
}

/** Siglas de un equipo para el escudo provisional: "Real Madrid" -> "RMA". */
export function initials(name: string) {
  const words = name.replace(/[^\p{L}\s']/gu, ' ').split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0].slice(0, 1) + words[1].slice(0, 2)).toUpperCase();
}
