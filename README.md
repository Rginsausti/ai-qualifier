# Agente Alma · vista previa

Alma es un acompañante digital que escucha tus horarios, revisa tu alacena y recorre tu barrio para que elegir saludable sea la opción más simple. Todo está escrito en lenguaje llano porque la tecnología queda detrás: lo único que ves son historias, misiones y recordatorios con voz humana.

## Qué podés hacer hoy
- Registrar ánimo, hambre y antojos con tres toques.
- Ver qué hay en tu despensa y qué locales cercanos tienen lo que falta.
- Recibir sugerencias inmediatas de comidas reales con ingredientes cotidianos.
- Seguir misiones gamificadas que premian las pequeñas victorias.
- Hablar con el demo de coach y sentir cómo Alma responde en menos de un minuto.

## Ritual diario en 5 minutos
1. **Check-in lúdico:** contás cómo venís y Alma aprende tus ritmos.
2. **Match con la alacena:** detecta lo que tenés y lo combina con lo disponible en tu zona.
3. **Receta o plan B:** propone un plato, un snack o un paseo saludable.
4. **Mensaje con onda:** te envía un recordatorio cariñoso cuando tu energía baja.
5. **Misiones y streaks:** sumás puntos tipo juego para sostener el hábito.

## Barrio + alacena en lenguaje humano
Analizamos dónde vivís, qué comercios confiables te rodean y qué ingredientes ya tenés. Con eso armamos tableros como “Despensa zen”, “Ánimo & hambre” o “Locales aliados” que podés leer de un vistazo, sin tecnicismos.

## Gamificación mindful
El tablero de misiones trae retos como “Misiones Ayurveda”, “Despensa express” o “Explorador de barrios”. Cada misión tiene puntos, estatus y un beneficio emocional claro. Nada de métricas inentendibles: sólo pasos accionables.

## Internacionalización instantánea
Toda la app está tokenizada con i18next. Podés cambiar entre español, inglés, portugués, italiano, francés, alemán y japonés desde el selector superior y automáticamente se adapta la historia, los botones, la demo conversacional y cada tarjeta del dashboard.

## Cómo sumarte
- Explorá la vista previa.
- Probá el ritual demo y dejá tu feedback.
- Reservá un lugar en la beta privada para recibir la demo guiada cuando abramos más cupos.

## Notificaciones push (setup rápido)
1. Ejecutá `npx web-push generate-vapid-keys` y copiá el par generado en `.env.local` usando las variables `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
2. Ajustá `PUSH_NOTIFICATIONS_CONTACT` con un mail válido (formato `mailto:tunombre@dominio.com`).
3. Desplegá las migraciones (`pnpm ts-node scripts/run-migration.js 010`) para crear `user_settings`, `push_subscriptions` y `notification_events`.
4. Programá las llamadas a `POST /api/notifications/cron` con `type=water`, `type=meal`, `type=day_end` o `type=nearby_search` desde Vercel Cron o Upstash QStash, pasando `Authorization: Bearer ${CRON_SECRET}`.
5. Para recibir avisos en iOS, instalá Alma como PWA (Agregar a pantalla de inicio) y luego activá las notificaciones desde el botón de campana.

## Architecture and roadmap
- `docs/architecture/README.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/scalability-minimal-infra.md`
- `docs/architecture/recommendation-quality.md`
- `docs/architecture/personalization-loop.md`
- `docs/architecture/implementation-roadmap.md`
