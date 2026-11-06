# Estructura de `src/`

- `screens/`: pantallas (solo diseño; reciben los datos ya calculados).
- `theme/`: colores y estilos comunes. Rediseñar la app = tocar aquí y en `screens/`.
- `logic/`: cálculo de probabilidades y recomendaciones, sin nada de diseño.
- `data/`: llamadas a nuestro servidor (la app nunca llama directamente a la API de fútbol).
