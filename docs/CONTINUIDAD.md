# CONTINUIDAD DE DESARROLLO - URBSEND
> Guía para que otro desarrollador pueda continuar el proyecto sin reinventarlo.

---

## Estructura del repositorio

```
urbsend-project/
├── backend/                  ← API REST + WebSocket (Node.js)
│   ├── index.js              ← Archivo principal, todos los endpoints
│   ├── etaCalculator.js      ← Lógica de cálculo ETA con IA
│   ├── priceCalculator.js    ← Lógica de precios por zona/distancia
│   ├── prisma/
│   │   ├── schema.prisma     ← Modelos de base de datos
│   │   └── migrations/       ← Historial de cambios en BD
│   ├── uploads/              ← Fotos de entrega subidas por conductores
│   └── .env                  ← Variables de entorno (NO subir a git)
│
├── frontend/                 ← Aplicación web (React 19)
│   └── src/
│       ├── App.jsx           ← Componente raíz, estado global, rutas
│       ├── views/            ← Páginas principales
│       │   ├── LandingView.jsx
│       │   ├── LoginView.jsx
│       │   ├── RegisterView.jsx
│       │   ├── ClientView.jsx        ← Panel del cliente
│       │   ├── DriverView.jsx        ← Panel del conductor
│       │   ├── AdminView.jsx         ← Panel del admin
│       │   ├── AdminAnalyticsView.jsx
│       │   ├── AdminDriversView.jsx
│       │   ├── TrackingView.jsx      ← Rastreo de pedidos
│       │   ├── ClientHistoryView.jsx
│       │   └── DriverEarningsView.jsx
│       ├── components/       ← Componentes reutilizables
│       │   ├── Navbar.jsx
│       │   ├── Footer.jsx
│       │   ├── Toast.jsx
│       │   ├── ChatWidget.jsx        ← Chat en tiempo real
│       │   └── ETADisplay.jsx        ← Componente de ETA
│       └── hooks/
│           └── useChat.js            ← Hook para Socket.io
│
├── urbsend_apps/             ← App móvil Flutter (conductores)
│   └── lib/
│       ├── main.dart
│       ├── login_screen.dart
│       ├── driver_home.dart
│       └── api_service.dart  ← Llamadas al backend
│
├── docs/                     ← Esta documentación
├── docker-compose.yml        ← Base de datos PostgreSQL
├── .env.example              ← Variables para docker-compose
└── README.md
```

---

## Patrón del proyecto

El backend sigue un patrón **monolítico modular**:
- Todos los endpoints están en `index.js`
- Los módulos de lógica (ETA, precios) están en archivos separados
- Prisma maneja el acceso a datos con un cliente compartido

El frontend sigue un patrón **estado en App.jsx**:
- El estado global (pedidos, conductores, mapa) vive en `App.jsx`
- Las vistas reciben datos por props
- Los componentes reutilizables son autocontenidos

---

## Cómo agregar un nuevo endpoint en el backend

1. Abrir `backend/index.js`
2. Buscar la sección correspondiente (hay comentarios tipo `// ===== PEDIDOS =====`)
3. Agregar el endpoint siguiendo este patrón:

```javascript
// Descripción del endpoint
app.get("/api/nueva-ruta/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await prisma.order.findUnique({ where: { id } });
    if (!resultado) return res.status(404).json({ error: "No encontrado" });
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
```

---

## Cómo agregar una nueva vista en el frontend

1. Crear el archivo en `frontend/src/views/NuevaVista.jsx`
2. Seguir la estructura de una vista existente (ej: `ClientView.jsx`)
3. Agregar la ruta en `frontend/src/App.jsx`:

```jsx
// En el bloque de <Routes>
<Route path="/nueva-ruta" element={<NuevaVista />} />
```

4. Importar el componente al inicio de App.jsx:
```jsx
import NuevaVista from './views/NuevaVista';
```

---

## Cómo agregar un campo nuevo a la base de datos

1. Modificar `backend/prisma/schema.prisma` (agregar el campo al modelo)
2. Ejecutar la migración:
```bash
cd backend
npx prisma migrate dev --name nombre_descriptivo
```
3. El cliente Prisma se actualiza automáticamente
4. Usar el campo en los endpoints de `index.js`

---

## Cómo funciona el ETA con IA

Archivo: `backend/etaCalculator.js`

```
ETA final = OSRM_duration × factor_tráfico × factor_zona × factor_urgencia + 5min

Factores de tráfico (por hora):
- 7-9am  → ×1.4  (hora pico mañana)
- 12-14pm → ×1.25 (almuerzo)
- 17-20pm → ×1.5  (hora pico tarde)
- 22-6am  → ×0.8  (noche)

Factores de zona (Arequipa):
- Centro histórico → ×1.35
- Miraflores       → ×1.2
- Yanahuara        → ×1.15
- Cayma            → ×1.1

Factor urgencia Express: ×0.85
```

El OSRM provee la duración base al calcular la ruta en el frontend (App.jsx → `fetchRoute()`).

---

## Cómo funciona el Chat en tiempo real

- **Backend**: Socket.io en namespace `/chat` (dentro de `index.js`)
- **Frontend**: Hook `useChat.js` + componente `ChatWidget.jsx`
- **Flujo**:
  1. Cliente/conductor se une a sala con `join-order(orderId)`
  2. Envía mensajes con `send-message`
  3. Backend guarda en BD (tabla `Message`) y hace broadcast con `new-message`
  4. Al abrir el chat, se carga historial desde la BD

---

## Deuda técnica y pendientes

| Tarea | Prioridad | Descripción |
|-------|-----------|-------------|
| HTTPS / TLS | Alta | Implementar certificado SSL con Let's Encrypt |
| Google Analytics | Media | Agregar tracking de usuarios |
| SEO | Media | Meta tags, sitemap, robots.txt |
| Autenticación JWT | Media | Actualmente no hay tokens de sesión persistente |
| Tests unitarios | Media | No hay tests implementados |
| CMS con Astro | Baja | Landing page editable sin código |
| Rate limiting | Alta | Proteger endpoints de abuso |
| Paginación en listas | Media | `/api/orders` devuelve máximo 20, sin paginación real |

---

## Bugs conocidos

| Bug | Cómo reproducir | Código afectado |
|-----|----------------|-----------------|
| Prisma generate falla en Windows con servidor corriendo | Ejecutar `npx prisma generate` mientras el backend está activo | `node_modules/.prisma/client/` - bloqueo de archivo |
| ETA no se recalcula si el conductor no actualiza ubicación | El conductor no tiene tracking GPS automático | `etaCalculator.js` → `recalculateETAFromLocation()` |
| Chat no persiste si el usuario recarga sin estar conectado al socket | El historial carga al conectar, pero mensajes nuevos en offline no llegan | `useChat.js` → `message-history` event |

---

## Credenciales de prueba (solo desarrollo)

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@urbsend.com | admin123 |
| Conductor 1 | juan@urbsend.com | moto123 |
| Conductor 2 | maria@urbsend.com | moto123 |
| Conductor 3 | pedro@urbsend.com | moto123 |

> ⚠️ Cambiar todas estas credenciales antes de producción real.
