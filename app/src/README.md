# Estructura de `src/`

- `app/`: pantallas (Expo Router: cada archivo es una pantalla).
  - `(tabs)/`: barra inferior. `index.tsx` = Partidos; Rankings, Para ti e Historial aún vacías.
  - `partido/[id].tsx`: ficha del partido (Resumen, Goles, Córners, Tarjetas, H2H).
- `components/`: piezas visuales (tarjeta de partido, barras, forma, botones).
- `theme/`: colores y letras. Rediseñar la app = tocar aquí, en `components/` y en `app/`.
- `logic/`: formato de números/fechas y comparación con la cuota, sin nada de diseño.
- `data/`: lectura de nuestro servidor (Supabase). La app nunca llama a la API de fútbol.
  La clave de `app.json` (`supabasePublishableKey`) es pública por diseño: solo permite leer.
