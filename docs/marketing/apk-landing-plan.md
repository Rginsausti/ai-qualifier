# APK Landing Plan (ES-first)

## Funnel Goal
- Primary funnel: `landing_view -> cta_download_click -> apk_download_success -> app_first_open`.
- North-star KPI: `app_first_open / landing_view`.

## Landing Structure
1. Hero: value proposition + main CTA (`Descargar APK para Android`).
2. Install in 3 steps: download, allow installation, open app.
3. Security and trust: signed APK, SHA-256 checksum, build date, clear permissions.
4. Core benefits: speed, simplicity, local relevance, habit support.
5. FAQ: compatibility, safety, updates.
6. Sticky mobile CTA: always visible near bottom.

## Copy Blocks (Spanish)

### Hero
- Title: `Pide mejor con Eatapp en Android`
- Subtitle: `Descarga la APK oficial y empezá en minutos.`
- CTA: `Descargar APK para Android`
- Meta line: `Version {{version}} · {{size}} MB · Actualizada {{date}}`

### Install steps
- `1) Descargá el archivo APK`
- `2) Permití la instalación cuando Android lo solicite`
- `3) Abrí Eatapp e iniciá sesión`

### Trust section
- `APK firmada digitalmente por Eatapp`
- `Verificá el hash SHA-256 antes de instalar`
- `Sin permisos innecesarios`

## Tracking Plan

### Web events
- `landing_view`
- `cta_download_click`
- `apk_download_start`
- `apk_download_success`
- `install_guide_view`
- `faq_expand`
- `support_click`

### App events
- `app_first_open` (with `install_source=apk_landing`)
- `onboarding_started`
- `onboarding_completed`

### Event properties
- `utm_source`, `utm_campaign`, `locale`, `device_os_version`, `apk_version`, `page_variant`.

## Technical Implementation

### Pages and endpoints
- Page: `/apk` (dedicated Android download landing).
- `GET /api/apk/latest`
  - returns: `version`, `size_mb`, `sha256`, `updated_at`, `min_android`, `download_url`.
- `GET /api/apk/download`
  - validates availability and redirects to storage/CDN URL.
- `POST /api/events/landing`
  - optional server-side analytics fallback.

### Security baseline
- Serve download over HTTPS only.
- Publish SHA-256 and app signing fingerprint.
- Use controlled artifact storage and explicit versioning.
- Keep old vulnerable builds unavailable.

## Delivery Plan

### MVP (3 days)
- Day 1: finalize ES copy, layout sections, event schema.
- Day 2: implement `/apk` + `GET /api/apk/latest` + `GET /api/apk/download`.
- Day 3: QA Android install flow + tracking verification + launch.

### V2 (2 weeks)
- A/B test hero and CTA labels.
- Add visual install guide per Android version.
- Add channel-level dashboard and cohort tracking (`download -> first_open`).

## Risks and Mitigations
- Trust friction (APK outside Play Store)
  - mitigate with explicit signature/hash and plain-language security messaging.
- Attribution gaps between web and app
  - mitigate with `install_source` and persistent UTM mapping.
- Install friction by Android version
  - mitigate with short, version-specific install instructions.
