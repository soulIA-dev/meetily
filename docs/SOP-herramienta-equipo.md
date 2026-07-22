# SOP: Soul IA Reuniones como herramienta de equipo

Fecha: 2026-07-22. Estado: arquitectura para validar con Jorge antes de construir.

## Para qué existe (objetivo real)

Que cualquier persona del equipo (p. ej. Isaac como manager) grabe sus reuniones en local con marca Soul IA y que el CONOCIMIENTO de esas reuniones acabe centralizado en el CRM sin fricción: quién se reunió, cómo llamó a la reunión y qué se dijo (transcripción completa). Jorge tiene visibilidad de la actividad sin perseguir a nadie.

Cuando funciona: un manager termina una reunión y, sin hacer nada más que ponerle nombre, su transcripción aparece en su perfil del CRM y Jorge puede leerla.

## Quién entra y desde dónde

- **Miembros del equipo** con cuenta en el CRM (Isaac y futuros). Llegan a la herramienta desde **CRM → Herramientas → tarjeta "Soul IA Reuniones"** (descarga del instalador + instrucciones en 3 pasos).
- **Jorge**: usa su instalación actual (flujo propio con dual-track + pipeline local); además ve en el CRM la actividad del equipo.

## Qué debe entender y sentir al entrar

Que es una herramienta interna de Soul IA (marca sobria: acentos naranja/cian, logo, sin estridencias), que respeta la privacidad (el audio NUNCA sale de su PC; solo sube el texto) y que trabaja para ellos (no un chivato: lo que sube lo ven ellos en su perfil).

## Recorrido (sección a sección, con su porqué)

1. **Descarga desde el CRM** (por qué: distribución controlada, versión canónica única, cero soporte de "de dónde lo bajo").
2. **Login con las credenciales del CRM al abrir la app** (por qué: identifica QUIÉN graba para poder guardar en SU perfil; reutiliza cuentas existentes, sin contraseñas nuevas). Sesión recordada con token; logout en ajustes.
3. **Graba con un clic** (detector de reuniones opcional en fase posterior; al principio, botón manual). Al parar, la app pide/confirma el **nombre de la reunión** (por qué: ese nombre es el título con el que se archiva en el CRM; forzarlo evita cien "Meeting 22_07").
4. **Subida automática al CRM al terminar**: título + transcripción completa + duración + fecha, contra el endpoint autenticado. El audio se queda en su PC (por qué: privacidad, tamaño, RGPD; el texto es el activo de trabajo). Si no hay red, se encola y reintenta.
5. **Perfil del usuario en el CRM → pestaña "Reuniones"**: lista de sus reuniones (título, fecha, duración) y detalle con transcripción completa (por qué: es SU herramienta de trabajo; lo que sube lo consulta él, eso hace que la adopten).
6. **Visibilidad para Jorge**: registro de actividad (logins, grabaciones subidas, fallos de subida) consultable en el CRM, y resumen a demanda (por qué: informar sin push recurrente, regla vigente).

## Decisiones de criterio (a validar)

- **Transcripción del equipo = la de la propia app** (Parakeet v3 multilingüe, en su PC). No depende de la GPU de Jorge ni del VPS (que no tiene GPU). Contra: sin separación de hablantes. El `dual_track.wav` queda en su disco por si una reunión concreta merece reproceso fino.
- **El audio no sube al CRM**: solo texto y metadatos.
- **Auth contra los usuarios existentes del CRM** con token de larga duración en la app.
- **Aviso a Jorge**: solo registro en CRM (sin Telegram/push), consistente con su regla anti-ruido.
- Los managers NO llevan el watcher/detector en fase 1 (es un extra de Jorge); botón manual y a correr.

## Fases de construcción

- **F1 (app, fork)**: pantalla de login CRM + guardado de token; al parar grabación, diálogo de título + subida (transcript + metadatos); branding sutil (acentos de color, about con marca).
- **F2 (CRM)**: endpoints `auth` + `ingest-transcript`; tabla `team_meeting_transcripts` (user_id, title, transcript, duration, recorded_at); pestaña "Reuniones" en el perfil; tarjeta de descarga en Herramientas; log de actividad.
- **F3**: detector de reuniones para el equipo, resumen automático, mejora con diarización en diferido (si algún día compensa).

## Riesgos y límites

- RGPD/consentimiento: grabar reuniones con terceros exige avisar al interlocutor; va una nota en la tarjeta de Herramientas (responsabilidad de quien graba).
- El instalador vive en GitHub Releases del fork `soulIA-dev/meetily` (repo público, sin secretos embebidos: el CRM URL es público y el auth es en runtime); la tarjeta del CRM enlaza a la versión canónica.
- Mantenimiento: cada rebase de upstream debe recompilar y re-testear login+subida.
