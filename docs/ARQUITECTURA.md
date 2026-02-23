# ARQUITECTURA - URBSEND

## Descripción General

URBSEND es una plataforma de logística urbana para Arequipa, Perú. Conecta clientes que necesitan envíos con conductores disponibles, con seguimiento en tiempo real.

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO FINAL                           │
│              (Navegador Web / App Flutter)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React 19)                        │
│                    Puerto: 5173 (dev)                           │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ LandingView │  │ ClientView  │  │      AdminView          │ │
│  │ LoginView   │  │ TrackingView│  │  AdminAnalyticsView     │ │
│  │ RegisterView│  │HistoryView  │  │  AdminDriversView       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ DriverView  │  │ChatWidget   │  │     ETADisplay          │ │
│  │ EarningsView│  │useChat.js   │  │     MapLibre GL         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API / Socket.io
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js + Express 5)                 │
│                       Puerto: 3001                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     index.js                             │   │
│  │                                                          │   │
│  │  REST Endpoints:          WebSocket (/chat):             │   │
│  │  POST /api/register/*     join-order                     │   │
│  │  POST /api/login/*        send-message                   │   │
│  │  GET/POST /api/orders     new-message                    │   │
│  │  PATCH /api/orders/:id    typing / mark-read             │   │
│  │  GET /api/orders/:id/eta                                 │   │
│  │  GET /api/orders/:id/invoice                             │   │
│  │  GET /api/drivers                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────────────────┐     │
│  │  etaCalculator.js  │  │     priceCalculator.js         │     │
│  │  - Factores tráfico│  │  - Precio base + distancia     │     │
│  │  - Zonas Arequipa  │  │  - Urgencia Express            │     │
│  │  - OSRM duration   │  │  - Zonas geográficas           │     │
│  └────────────────────┘  └────────────────────────────────┘     │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────────────────┐     │
│  │    Nodemailer      │  │         PDFKit                 │     │
│  │  (notif. email)    │  │  (boleta / factura PDF)        │     │
│  └────────────────────┘  └────────────────────────────────┘     │
└────────────────┬─────────────────────────┬───────────────────────┘
                 │ Prisma ORM              │ HTTP externo
                 ▼                         ▼
┌───────────────────────┐    ┌──────────────────────────────┐
│   PostgreSQL 15       │    │   OSRM (router.project-osrm) │
│   Puerto: 5432        │    │   Cálculo de rutas reales    │
│   (Docker)            │    │   - Distancia                │
│                       │    │   - Duración del trayecto    │
│  Tablas:              │    └──────────────────────────────┘
│  - User               │
│  - Driver             │    ┌──────────────────────────────┐
│  - Order              │    │   Nominatim (OpenStreetMap)  │
│  - Message            │    │   Geocodificación inversa    │
└───────────────────────┘    └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    APP MÓVIL (Flutter)                          │
│                  Android / iOS (separado)                       │
│                                                                 │
│  - Login conductor                                              │
│  - Ver pedidos asignados                                        │
│  - Actualizar estado                                            │
│  - Conecta al mismo backend (puerto 3001)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes y Responsabilidades

| Componente | Tecnología | Puerto | Responsabilidad |
|------------|-----------|--------|-----------------|
| Frontend Web | React 19 + Vite | 5173 | UI cliente, admin, conductor |
| Backend API | Node.js + Express 5 | 3001 | Lógica de negocio, REST, WebSocket |
| Base de Datos | PostgreSQL 15 | 5432 | Persistencia de datos |
| Chat Tiempo Real | Socket.io | 3001 | Mensajería cliente-conductor |
| Mapas | MapLibre GL | - | Visualización de rutas |
| Rutas | OSRM (externo) | - | Cálculo de rutas reales |
| Geocodificación | Nominatim (externo) | - | Búsqueda de direcciones |
| App Móvil | Flutter | - | App conductor Android/iOS |

---

## Flujo Principal de un Pedido

```
1. Cliente crea pedido (ClientView)
         │
         ▼
2. Backend guarda en BD → calcula precio + ETA
         │
         ▼
3. Admin asigna conductor (AdminView)
         │
         ▼
4. Conductor ve pedido (DriverView) → acepta
         │
         ▼
5. Conductor inicia ruta → estado EN_CAMINO
         │
         ▼
6. Cliente rastrea en tiempo real (TrackingView)
         │  └── ve ETA dinámico
         │  └── chat con conductor (Socket.io)
         ▼
7. Conductor sube foto de entrega → ENTREGADO
         │
         ▼
8. Cliente recibe notificación (Email / WhatsApp)
         │
         ▼
9. Cliente descarga comprobante PDF (boleta/factura)
```

---

## Modelos de Base de Datos

```
User (Clientes)
├── id, email, password, name, phone
└── orders → Order[]

Driver (Conductores)
├── id, email, password, name, phone
├── vehicleType, vehiclePlate, vehicleBrand
├── driverLicense, vehicleSOAT (URLs docs)
├── isOnline, isVerified, rating
└── orders → Order[]

Order (Pedidos)
├── id, status (PENDIENTE/ASIGNADO/EN_CAMINO/ENTREGADO)
├── originAddress, originLat/Lng
├── destAddress, destLat/Lng
├── packageSize, urgency, price, paymentMethod
├── etaMinutes, estimatedArrival (ETA con IA)
├── proofImage (foto entrega)
├── userId → User
├── driverId → Driver
└── messages → Message[]

Message (Chat)
├── id, orderId, sender (CLIENT/DRIVER)
├── content, read, timestamp
└── order → Order
```
