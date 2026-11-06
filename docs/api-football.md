# API-Football: qué da el plan gratis (probado el 06/11/2026)

Clave guardada como secreto del entorno «App-f-tbolestadisticas» (cabecera `x-apisports-key`).
El código nunca debe contener la clave.

## Funciona
| Consulta | Ejemplo | Notas |
|---|---|---|
| Estado de la cuenta | `/status` | Plan Free, 100 consultas/día |
| Partidos por fecha | `/fixtures?date=2026-11-06` | **Solo ayer, hoy y mañana** (363 partidos hoy) |
| Estadísticas de un partido | `/fixtures/statistics?fixture=ID` | Córners, amarillas, rojas, tiros, xG |
| Cuotas | `/odds?fixture=ID` | 10 casas (Bet365, Pinnacle…). Bet365: 83 mercados, con córners y tarjetas |
| Enfrentamientos directos | `/fixtures/headtohead?h2h=536-542` | Incluye temporadas 2025 y 2026 |
| Árbitro | campo `fixture.referee` | Viene en el partido |
| Temporadas antiguas | `season=2022`, `2023`, `2024` | Para probar el modelo con datos históricos |

## No funciona en el plan gratis
- Temporadas 2025 y 2026 (la actual) por liga o por equipo.
- Fechas fuera de ayer/hoy/mañana.
- El parámetro `last` (últimos N partidos) y probablemente `next`.

## Conclusión
- **Para desarrollar:** el plan gratis vale. Se puede construir el modelo y probarlo con
  las temporadas 2022-2024 y ver los partidos y cuotas de hoy.
- **Para predicciones reales de hoy:** falta la forma reciente de los equipos (temporada
  actual), que el plan gratis no da. Hará falta el plan **Pro** (~18 €/mes) cuando el
  modelo esté listo, tal como estaba previsto en el presupuesto.
- Alternativa gratis parcial: el servidor guarda cada día los partidos y resultados de
  ayer/hoy/mañana y va acumulando historial propio desde ahora (lento: semanas).
