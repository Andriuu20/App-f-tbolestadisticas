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
