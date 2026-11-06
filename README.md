# Proyecto: App de estadísticas y probabilidades de fútbol (estilo FootyStats)

> Documento de partida del proyecto. Recoge todo lo decidido hasta ahora.
> Boceto visual (4 pantallas de iPhone): https://claude.ai/artifact/LgU9hPDoVqf6TSqruHQfqG

---

## 1. Idea

App para el móvil que muestra estadísticas y probabilidades de los partidos de fútbol, parecida a FootyStats: probabilidad de más de 0,5 / 1,5 / 2,5 / 3,5 goles, ambos marcan, córners, tarjetas, 1X2, forma de los equipos, etc.

Además tendrá funciones propias:
- **3 apuestas recomendadas por partido** (segura, media y arriesgada).
- **Análisis de capturas de apuestas** (por ejemplo de Bet365): el usuario sube la captura y la app le dice la probabilidad de acierto y si le conviene cambiar algo.
- **Historial** para comprobar si las predicciones aciertan.

"Parecida" a FootyStats en funciones y estructura, pero **con diseño, nombre, logo y textos propios** (copiarlos traería problemas legales al publicarla).

---

## 2. Fases

### Fase 1 (ahora): uso personal
- Solo para el propietario, en su iPhone. **No se publica** en App Store ni Google Play.
- Se prueba con la app **Expo Go** (gratis), sin pagar la cuenta de Apple.
- Objetivo: comprobar con el historial que las probabilidades se cumplen antes de invertir más.

### Fase 2 (futuro): publicación
- Publicar primero en **iOS (App Store)** y después en **Android (Google Play)**. Más adelante, versión web.
- Se invertirá más dinero cuando la app funcione bien.

---

## 3. Pantallas (según el boceto)

1. **Partidos de hoy**
   - Selector de día (Ayer, Hoy, próximos días) y de liga (LaLiga, Premier, Serie A, Bundesliga, Champions…).
   - Tarjeta por partido: hora, equipos y 3 datos rápidos: % más de 2,5 goles, % ambos marcan, media de córners.
   - Al tocar un partido se abre su ficha.
2. **Ficha del partido**
   - Equipos con la forma de los últimos 5 partidos (V/E/D) y los goles esperados de cada uno.
   - Pestañas: Resumen, Goles, Córners, Tarjetas, H2H (enfrentamientos directos).
   - Probabilidades 1X2 (local / empate / visitante).
   - Barras de goles: más de 0,5, 1,5, 2,5 y 3,5, y ambos marcan.
   - Córners (media y % de más de X) y tarjetas (media, media del árbitro y % de más de X).
   - Botón "Ver 3 apuestas recomendadas".
3. **Recomendaciones ("Para ti")**
   - Campo "Si apuestas X €".
   - Las 3 apuestas (segura, media, arriesgada), cada una con: probabilidad estimada, cuota, lo que se recibe, "fallas ~X de cada 10" y la explicación de por qué se recomienda.
   - Aviso: "Estimaciones estadísticas, no garantías".
4. **Rankings**
   - Equipos ordenados por % de partidos con más de 2,5 goles, ambos marcan, córners o tarjetas, con selector de mercado.
5. **Historial** (pendiente de diseñar)
   - Apuestas analizadas o recomendadas con su resultado real y porcentaje de acierto por nivel.
6. **Analizar captura** (pendiente de diseñar)
   - Subir la captura de una apuesta y ver el análisis.

Barra inferior: Partidos · Rankings · Para ti · Historial.

---

## 4. Funciones en detalle

### 4.1 Estadísticas tipo FootyStats
- Mercados: 1X2, doble oportunidad, más/menos goles (0,5 a 4,5), ambos marcan, goles en la 1.ª parte, córners, tarjetas amarillas y rojas, hándicaps.
- Datos por equipo: goles a favor y en contra, local y visitante por separado, forma reciente, xG si la API lo da.
- Enfrentamientos directos, clasificación de la liga y ficha de cada equipo.

### 4.2 Cálculo de probabilidades
- **Porcentajes históricos:** en cuántos de los últimos partidos se cumplió el mercado (ej.: 7 de 10 → 70 %).
- **Goles:** modelo de Poisson / Dixon-Coles con la fuerza en ataque y defensa de cada equipo (local y visitante por separado).
- **Córners y tarjetas:** medias a favor y en contra con Poisson o binomial negativa.
- **Árbitro:** media de tarjetas por partido (clave para el mercado de tarjetas).
- **Forma reciente:** los últimos 5-10 partidos pesan más que los antiguos.
- **Contexto:** local/visitante, derbis, bajas si la API las da.
- **Valor frente a la casa:** comparar la probabilidad del modelo con la implícita en la cuota (1/cuota, quitando el margen de la casa). Si la del modelo es mayor, la apuesta "tiene valor".
- **Combinadas del mismo partido:** tener en cuenta que hay mercados relacionados (ganar claro y más córners, por ejemplo); no multiplicar probabilidades a ciegas.

### 4.3 Las 3 apuestas recomendadas por partido
- **Segura (la prioridad):** cuota objetivo **1,30-1,60** (apuestas 10 €, recibes 13-16 €). La cuota implica un 60-75 %; la app solo la propone si su modelo estima más (con valor), idealmente 70-85 %. Puede ser una sola selección o dos muy probables combinadas (ej.: "no pierde" 1,20 + "más de 7,5 córners" 1,25 = 1,50).
- **Media:** cuota 1,80-2,50, probabilidad estimada 40-55 %.
- **Arriesgada:** cuota 4,00-10+, probabilidad estimada 10-25 %.
- Mostrar siempre: "Con esta probabilidad, de cada 10 veces que la juegues, fallarás unas X".
- Una apuesta que paga x2 o x3 **no puede ser segura** (cuota 2,00 ≈ 50 %, cuota 3,00 ≈ 33 %).
- Las tarjetas rojas son raras (al menos una en ~1 de cada 5-8 partidos de LaLiga): solo pueden aparecer en la apuesta arriesgada.

### 4.4 Análisis de capturas de apuestas
1. El usuario sube la captura (por ejemplo de Bet365).
2. Una IA con visión (API de Claude) extrae los partidos, los mercados y las cuotas.
3. La app calcula la probabilidad de cada selección y de la combinada completa.
4. Resultado: probabilidad estimada, si la cuota tiene valor y alternativas más probables.
   - Ejemplo: "Tu combinada de 4 partidos tiene un 9 % de probabilidad. Alternativa: más de 1,5 goles en este partido, 78 % estimado, cuota 1,30."
- Recordar que en las combinadas las probabilidades se multiplican: 4 apuestas del 70 % = 24 % de acertarlas todas.

### 4.5 Historial y comprobación (calibración)
- Guardar cada análisis y recomendación con su resultado real.
- Mostrar el % de acierto y el beneficio o pérdida por nivel (segura, media, arriesgada).
- Regla clave: a cuota ~1,45, para no perder dinero hay que acertar más del **~69 %**. Si la "segura" no lo consigue, hay que ajustar el modelo.

---

## 5. Datos: APIs y precios
(Precios aproximados a noviembre de 2026, sacados de búsquedas; confirmarlos en las webs oficiales antes de pagar.)

### API-Football (recomendada)
| Plan | Precio/mes | Consultas/día |
|---|---|---|
| Free | 0 € | 100 (máx. 10/minuto) |
| Pro | ~19 $ (~18 €) | 7.500 |
| Ultra | ~29 $ (~27 €) | 75.000 |
| Mega | ~39 $ (~36 €) | 150.000 |
- Según su propia guía, todos los planes incluyen todos los datos (partidos, estadísticas, córners, tarjetas, árbitros, alineaciones, cuotas, predicciones). Pagar da más consultas. Confirmar si el plan gratis limita temporadas.
- Para uso personal sobra el plan Pro. Ultra solo si hay resultados en directo con muchos usuarios.

### FootyStats API (alternativa)
| Plan | Precio/mes | Ligas |
|---|---|---|
| Hobby | 29,99 £ (~35 €) | 40 (a elegir) |
| Serious | 69,99 £ (~81 €) | 150 |
| Everything | 389,99 £ (~450 €) | Todas |
- Sin plan gratis. Los datos vienen ya calculados como en su web (% over, BTTS, córners, tarjetas, xG).
- Más cara; solo si se quieren exactamente sus mismos números.

### Otras
- football-data.org: gratis para las ligas principales, con menos detalle (sin córners ni tarjetas).

---

## 6. Arquitectura (importante para poder escalar)

- **Las consultas de la API son para toda la app, no por usuario.**
- Por eso **el servidor descarga los datos una vez, los guarda en la base de datos y todos los usuarios leen de ahí.** La app del móvil nunca llama directamente a la API de fútbol.
  - Así, el número de consultas depende de cuántas ligas y partidos se cubren, no de cuántos usuarios hay.
  - Estimación: ~30 ligas ≈ 100 partidos/día × ~5 consultas ≈ **500-1.000 consultas/día** (de sobra con el plan Pro).
  - Con este diseño, el plan Pro aguantaría miles de usuarios. Si cada usuario llamara a la API directamente, solo ~700.
- Tareas programadas en el servidor: cargar los partidos del día, sus estadísticas y cuotas; actualizar resultados al terminar; recalcular probabilidades.
- Resultados en directo (opcional, futuro): el servidor consulta cada pocos segundos los partidos en juego; ahí puede hacer falta el plan Ultra.
- Las claves de las APIs (fútbol y Claude) se guardan solo en el servidor, nunca en la app.
- Montarlo así **desde el principio**, aunque sea de uso personal, para no rehacerlo al publicar.

### Tecnología propuesta
- **App:** Expo (React Native) con TypeScript. Un solo código para iOS, Android y web.
- **Servidor y base de datos:** Supabase o Firebase (plan gratis al principio) o un servidor sencillo en Vercel/Cloudflare + base de datos.
- **IA para capturas:** API de Claude (visión), ~1-2 céntimos por captura.
- **Pagos (fase 2):** compras dentro de la app de Apple/Google, por ejemplo con RevenueCat.
- **Código organizado separando la lógica del diseño**, para poder rediseñar la app más adelante sin tocar lo que funciona.

---

## 7. Presupuesto y costes

### Fase 1 (uso personal): 50 € en total
- Desarrollo y pruebas con el plan **gratis** de API-Football: 0 €.
- Cuando funcione: **1 mes de API-Football Pro** (~18 €) para usarla con todas las ligas.
- IA para capturas: ~10-20 € de saldo (más de 1.000 capturas).
- Servidor: plan gratis (0 €).
- Expo Go en el iPhone: gratis.

### Instalarla en el iPhone sin publicarla
- **Gratis:** con Expo Go mientras se desarrolla.
- **Como app instalada con su propio icono:** cuenta de desarrollador de Apple (99 $/año), también para TestFlight. Alternativa gratis: instalar con un Apple ID gratuito desde un Mac con Xcode (caduca cada 7 días).

### Fase 2 (publicación)
- Apple App Store: 99 $/año. Google Play: 25 $ (pago único).
- API-Football Pro/Ultra: ~18-27 €/mes. Servidor: 0-30 €/mes según usuarios.
- Apple y Google se quedan un 15 % de las suscripciones (30 % por encima de 1 millón al año).

---

## 8. Modelo de negocio (fase 2, a decidir)
- Propuesta: **freemium** con suscripción (por ejemplo 1,99 €/mes o un plan anual).
  - Gratis: partidos del día, estadísticas básicas y alguna liga.
  - Premium: todas las ligas, las 3 recomendaciones, análisis de capturas ilimitado, rankings completos e historial.
- Cuentas orientativas: 1.000 suscriptores a 1,99 € ≈ 1.690 €/mes tras el 15 % de la tienda; costes ≈ 50 €/mes como mucho.

---

## 9. Avisos legales y de tiendas (antes de publicar)
- Revisar las **condiciones de uso comercial** de la API elegida: algunos planes no permiten mostrar sus datos en una app pública o exigen citarlos (FootyStats puede tener restricciones).
- No copiar el diseño, nombre, logo ni textos de FootyStats.
- Apple y Google aceptan apps de estadísticas deportivas, pero son más estrictos si hay relación con apuestas: **clasificación +18** y nada de publicidad de casas de apuestas sin licencia.
- Mostrar siempre que las probabilidades son estimaciones, no garantías, y que las casas de apuestas tienen margen a su favor.
- Incluir mensajes de juego responsable.

---

## 10. Diseño
- **Boceto actual:** https://claude.ai/artifact/LgU9hPDoVqf6TSqruHQfqG
  - Modo oscuro: fondo #0D1117, tarjetas #161B22, bordes #262D36, texto #E6EDF3, texto secundario #9AA4AF.
  - Acento verde lima #A3E635 (datos altos y la apuesta segura), azul #58A6FF (media), naranja #F0883E (arriesgada).
  - Letras: Inter (textos) y JetBrains Mono (números).
  - Código de las pantallas del boceto en `docs/boceto/` (formato del lienzo de diseño de Claude; sirve de referencia visual).
- **Diseño definitivo (más adelante):** cuando la app funcione, rediseñarla inspirándose en capturas de paneles de IA y trading (fondo oscuro, neón, datos, gráficos en movimiento, elementos 3D, consola con registros en directo). Es **inspiración, no copia**: antes de hacerlo, proponer 2-3 direcciones visuales para elegir.

---

## 11. Primeros pasos
1. Crear el entorno de Claude Code para este repositorio (sección 12) y el proyecto Expo (TypeScript). El repositorio de GitHub ya existe.
   - ✅ Hecho: entorno «App-f-tbolestadisticas» creado y proyecto Expo (SDK 58, TypeScript) en la carpeta `app/`. Para probarlo: `cd app && npx expo start` y escanear el QR con Expo Go.
2. Crear la cuenta gratis de API-Football y probar las consultas (partidos del día, estadísticas, córners, tarjetas, cuotas).
   - ✅ Hecho: cuenta creada y consultas probadas. Resultados y límites del plan gratis en `docs/api-football.md`.
3. Montar el servidor y la base de datos que descargan y guardan los datos (con caché).
   - ✅ Desplegado en Supabase (proyecto `futbol-stats`, https://jrtobjjboerhyelyycfv.supabase.co): tablas creadas, función `sync` subida y tarea programada cada 30 min. Falta guardar el secreto `API_FOOTBALL_KEY` (Edge Functions → Secrets) cuando API-Football reactive la cuenta.
4. Calcular las probabilidades (porcentajes históricos + Poisson) para 1X2, goles y ambos marcan.
   - 🟡 Modelo v1 en `server/supabase/functions/_shared/model/`, con pruebas y backtest (`npm run backtest` en `server/`). Acierta más que el azar pero menos que Bet365. Pendiente: equipos recién ascendidos, usar todos los partidos de cada equipo, tiros a puerta y córners/tarjetas.
5. Pantallas 1 y 2 (Partidos de hoy y Ficha del partido) con datos reales.
   - ✅ Hechas con datos reales de football-data.co.uk (5 ligas, próximos partidos con cuotas de Bet365) a través de Supabase; el servidor recalcula las predicciones cada 6 horas. Aviso visible de «modelo en pruebas».
6. Pantalla de rankings.
7. Las 3 recomendaciones y el historial con resultados reales.
8. Análisis de capturas con la API de Claude.
9. Probarla en el iPhone con Expo Go durante unas semanas y revisar el % de acierto.

---

## 12. Entorno de trabajo en Claude Code (nube)

- En la app de Claude, al abrir una sesión, dejar el entorno en **Auto** ("Follows your repositories"): usa el entorno guardado para este repositorio y, si no hay ninguno, el **Default**.
- Al empezar a programar, crear un **entorno propio para este repositorio** que:
  - Permita conectarse a la API de fútbol (API-Football: `v3.football.api-sports.io`; FootyStats: `api.football-data-api.com`, solo si se usa) y a la API de Claude (`api.anthropic.com`) para el análisis de capturas.
  - Guarde las claves de las APIs como **secretos del entorno** (nunca pegarlas en el chat ni subirlas al repositorio). API-Football usa la cabecera `x-apisports-key`.
  - Tenga un script de configuración que instale las dependencias del proyecto (por ejemplo `npm install`).
- Con el entorno en Auto, este entorno se elegirá solo cada vez que se abra el repositorio.
