# Modelo de probabilidades: resultados (06/11/2026)

Backtest con datos de football-data.co.uk (LaLiga, Premier, Serie A, Bundesliga y Ligue 1).
Ajustes elegidos con 2021-22 y 2022-23; prueba con 5.708 partidos de 2023-24 a 2026-27 que el ajuste no vio.
Salida completa: `docs/backtest-modelo-v2.txt`. Repetirlo: `cd server && npm run backtest`.

## Versiones
- **v1:** fuerza de ataque/defensa local y visitante por separado (Poisson).
- **v2 (en uso):** fuerza ajustada al rival con todos los partidos, ventaja de campo de la liga,
  recién ascendidos empiezan con fuerza 0,8, mezcla 50 % goles / 50 % tiros a puerta, semivida 365 días,
  Dixon-Coles rho = -0,1.

## Resultados (pérdida logarítmica, más baja = mejor)
| | 1X2 | Más de 2,5 |
|---|---|---|
| Azar | 1,0986 | 0,6931 |
| Modelo v1 | 0,9999 | 0,6794 |
| **Modelo v2** | **0,9863** | **0,6742** |
| Bet365 sin margen | 0,9654 | 0,6680 |

- v2 está bien calibrado: cuando dice 45 % pasa el 45 %; 64 % → 64-69 %.
- Recién ascendidos en casa: v1 decía que ganaban el 36 % (real 29 %); v2 dice 30 %.
- **Mezclar el modelo con Bet365 no mejora a Bet365 solo** (el mejor peso del modelo es 0 %).
  En 1X2 y goles el modelo no sabe nada que la casa no sepa.
- Apostar cuando el modelo ve "valor" pierde dinero (−16 % con valor > 5 %; la "segura" −6 %/−12 %).

## Conclusión
Con resultados y tiros a puerta no se puede ganar a Bet365 en los mercados principales.
Lo que sí da el modelo: probabilidades bien calibradas para mercados sin cuota en los datos
(ambos marcan, goles por equipo, marcadores) y la base para córners y tarjetas.

## Córners y tarjetas (06/11/2026)
Salida completa: `docs/backtest-corners.txt` (`node scripts/backtest-corners.ts <csv football-data> <json FootyStats>`).
- Modelo: córners/amarillas que fuerza y concede cada equipo, ajustado al rival; probabilidad de "más de X"
  con binomial negativa (dispersión 40), semivida 180 días.
- **Calibración** (football-data, 5.707 partidos 2023-2026): córners más de 9,5 → 45 % dice / 46 % pasa;
  54 % / 56 %; 63 % / 61 %. Amarillas más de 4,5 → 35 % / 35 %; 44 % / 42 %. Mejor que la media de la liga.
- **Frente a la casa** (FootyStats, clave de ejemplo, Premier 2019-20, 1.570 cuotas de córners 7,5-11,5):
  modelo 0,6217 y casa 0,6219 de pérdida (empate); mezclar los dos mejora (0,6205). Apostar cuando el modelo
  ve valor ganó +4 % a +7 %. **Muestra pequeña** (una temporada, una liga): puede ser suerte.
  Para confirmarlo hacen falta más temporadas y ligas con cuotas de córners (FootyStats de pago o API-Football).
- No hay cuotas de tarjetas en los datos, así que en tarjetas no se puede comparar con la casa.
