# 📦 URBSEND: Logistics & Last-Mile Delivery Ecosystem

![Versión](https://img.shields.io/badge/version-1.0.0-red)
![Status](https://img.shields.io/badge/Status-MVP_Completed-success)
![Location](https://img.shields.io/badge/Focus-Arequipa_Peru-blue)
![Tech](https://img.shields.io/badge/Stack-Fullstack-orange)

URBSEND es una solución integral de logística urbana diseñada para resolver la fragmentación en los servicios de mensajería de última milla. Conecta de manera eficiente a clientes finales, conductores y centros de control mediante una arquitectura robusta distribuida en Web, Mobile y Cloud.

**Autor:** Carlos Alberto Llano Flores

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        URBSEND ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │  Cliente Web │    │    Admin     │    │ Repartidor   │     │
│   │   (React)    │    │  Dashboard   │    │  (Flutter)   │     │
│   │  Port: 5173  │    │   (React)    │    │   Android    │     │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘     │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                  │
│                              ▼                                  │
│                    ┌─────────────────┐                         │
│                    │  REST API +     │                         │
│                    │  WebSocket      │                         │
│                    │  Express.js     │                         │
│                    │  Port: 3001     │                         │
│                    └────────┬────────┘                         │
│                             │                                  │
│                             ▼                                  │
│                    ┌─────────────────┐                         │
│                    │   PostgreSQL    │                         │
│                    │   Port: 5432    │                         │
│                    └─────────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend Web** | React 19, Vite, MapLibre GL JS, Lucide Icons, CSS3 |
| **Mobile App** | Flutter 3.x, Dart, Image Picker, URL Launcher |
| **Backend** | Node.js 18+, Express.js 5.x |
| **ORM** | Prisma ORM |
| **Base de Datos** | PostgreSQL 15 |
| **Tiempo Real** | Socket.io (Chat en vivo cliente-conductor) |
| **Servicios** | PDFKit (Invoicing), Nodemailer (Email), WhatsApp Web API |
| **Contenedores** | Docker (PostgreSQL) |

---

## 🚀 GUÍA DE DESPLIEGUE (DevOps)

> Para una guía más detallada, ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)

### Requisitos del Servidor

| Requisito | Especificación Mínima |
|-----------|----------------------|
| **Sistema Operativo** | Ubuntu 20.04+ / Debian 11+ / Windows Server 2019+ |
| **Node.js** | v18.x o superior |
| **PostgreSQL** | v15.x |
| **RAM** | 2 GB mínimo |
| **Almacenamiento** | 10 GB (incluye uploads de evidencias) |
| **Puertos** | 3001 (API), 5432 (DB), 80/443 (Frontend) |

---

### 📋 Variables de Entorno

Crear archivo `.env` en la carpeta `backend/` usando `backend/.env.example` como base:

```env
# Base de Datos (REQUERIDO)
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/urbsend_db"

# Puerto del servidor (OPCIONAL - default: 3001)
PORT=3001

# Notificaciones por Email (OPCIONAL)
EMAIL_USER="notificaciones@urbsend.com"
EMAIL_PASS="app-password-de-gmail"
```

> ⚠️ **IMPORTANTE:** Si `EMAIL_USER` y `EMAIL_PASS` no están configurados, las notificaciones se simularán en consola.

---

### 🐳 Opción A: Despliegue con Docker (Recomendado)

**1. Configurar variables de entorno para Docker:**
```bash
# En la raíz del proyecto
cp .env.example .env
nano .env
# Completar POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
```

**2. Levantar base de datos PostgreSQL:**
```bash
docker-compose up -d
```

**3. Verificar que está corriendo:**
```bash
docker-compose ps
```

---

### 🖥️ Opción B: Despliegue Manual

#### Paso 1: Clonar repositorio
```bash
git clone https://github.com/tu-usuario/urbsend-project.git
cd urbsend-project
git checkout v1.0-entrega-final
```

#### Paso 2: Configurar Base de Datos
```bash
psql -U postgres -c "CREATE DATABASE urbsend_db;"
psql -U postgres -c "CREATE USER urbsend WITH PASSWORD 'tu_contraseña';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE urbsend_db TO urbsend;"
```

#### Paso 3: Backend
```bash
cd backend
npm install
cp .env.example .env
nano .env
npx prisma migrate deploy
npx prisma generate
# Para producción con PM2:
pm2 start index.js --name "urbsend-api"
pm2 save
pm2 startup
```

#### Paso 4: Frontend (Build para producción)
```bash
cd frontend
npm install
npm run build
# Archivos estáticos generados en: frontend/dist/
```

#### Paso 5: Datos de prueba (Opcional)
```bash
curl http://localhost:3001/api/seed-drivers
```

---

### 🌐 Configuración de Nginx (Producción)

```nginx
server {
    listen 80;
    server_name TU_DOMINIO_O_IP;

    root /ruta/al/proyecto/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /uploads/ {
        proxy_pass http://localhost:3001;
    }
}
```

---

### 📱 App Móvil (Flutter)

La app móvil está en la carpeta `urbsend_apps/`.

**Configurar URL del backend** en `urbsend_apps/lib/api_service.dart`:
```dart
// Para producción:
static const String baseUrl = 'https://api.urbsend.com/api';
// Emulador Android: http://10.0.2.2:3001/api
// Dispositivo físico: http://192.168.x.x:3001/api
```

**Compilar APK:**
```bash
cd urbsend_apps
flutter pub get
flutter build apk --release
# APK en: build/app/outputs/flutter-apk/app-release.apk
```

---

## 🔌 API Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/register/client` | Registro de cliente |
| POST | `/api/register/driver` | Registro de conductor (multipart) |
| POST | `/api/login/client` | Login cliente |
| POST | `/api/login/driver` | Login conductor |

### Pedidos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/orders` | Listar pedidos |
| GET | `/api/orders/:id` | Obtener pedido |
| POST | `/api/orders` | Crear pedido |
| PATCH | `/api/orders/:id/status` | Actualizar estado |

### ETA con Inteligencia Artificial
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/orders/:id/calculate-eta` | Calcular ETA con IA |
| GET | `/api/orders/:id/eta` | Obtener ETA actual |
| PATCH | `/api/orders/:id/driver-location` | Actualizar ubicación conductor |

### Chat en Vivo (WebSocket - namespace `/chat`)
| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `join-order` | Cliente → Servidor | Unirse a sala del pedido |
| `send-message` | Cliente → Servidor | Enviar mensaje |
| `new-message` | Servidor → Cliente | Recibir mensaje nuevo |
| `typing` | Cliente → Servidor | Indicador escribiendo |
| `mark-read` | Cliente → Servidor | Marcar mensajes como leídos |

### Mensajes (REST)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/orders/:id/messages` | Historial de mensajes |
| GET | `/api/orders/:id/unread-count` | Contador de no leídos |

### Usuarios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/users/:userId/orders` | Historial cliente |
| GET | `/api/drivers/:driverId/orders` | Entregas conductor |
| GET | `/api/drivers` | Conductores activos |

### Administración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/drivers/pending` | Conductores por aprobar |
| PATCH | `/api/admin/drivers/:id/verify` | Aprobar/rechazar conductor |

### Facturación y Notificaciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/orders/:id/invoice?type=boleta` | Descargar PDF |
| GET | `/api/orders/:id/whatsapp?type=created` | URL WhatsApp |
| POST | `/api/orders/:id/notify` | Enviar notificación |

---

## 🔐 Credenciales de Prueba

### Administrador
```
Email: admin
Password: admin123
```

### Conductores (después de ejecutar seed)
```
Email: juan@urbsend.com    Password: moto123
Email: maria@urbsend.com   Password: moto123
Email: pedro@urbsend.com   Password: moto123
```

> ⚠️ Cambiar todas estas credenciales antes de un despliegue real en producción.

---

## 📁 Estructura del Proyecto

```
urbsend-project/
├── backend/
│   ├── index.js                  # Servidor Express + API + Socket.io
│   ├── etaCalculator.js          # Lógica ETA con IA (tráfico Arequipa)
│   ├── priceCalculator.js        # Lógica de precios por zona/distancia
│   ├── prisma/
│   │   ├── schema.prisma         # Esquema BD (User, Driver, Order, Message)
│   │   └── migrations/           # Historial de migraciones
│   ├── uploads/                  # Fotos de evidencia de entrega
│   ├── .env.example              # Plantilla de variables de entorno
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Componente raíz + estado global
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Toast.jsx
│   │   │   ├── ChatWidget.jsx    # Chat en tiempo real
│   │   │   └── ETADisplay.jsx    # Componente de ETA con IA
│   │   ├── hooks/
│   │   │   └── useChat.js        # Hook Socket.io para chat
│   │   ├── views/                # 13 vistas principales
│   │   └── index.css
│   └── package.json
│
├── urbsend_apps/                 # App móvil Flutter (conductores)
│   └── lib/
│       ├── main.dart
│       ├── login_screen.dart
│       ├── driver_home.dart
│       └── api_service.dart
│
├── docs/                         # Documentación técnica
│   ├── ARQUITECTURA.md           # Diagrama y componentes
│   ├── DESPLIEGUE.md             # Guía paso a paso para infra
│   ├── OPERACION.md              # Logs, backups, reinicios
│   └── CONTINUIDAD.md           # Guía para continuar desarrollo
│
├── docker-compose.yml            # Base de datos PostgreSQL
├── .env.example                  # Variables para docker-compose
├── URBSEND_PROJECT_SUMMARY.json  # Resumen técnico del proyecto
└── README.md
```

---

## 🌟 Funcionalidades Principales

### 📊 Admin Dashboard
- Analytics con gráficos de distribución de pedidos
- Gestión de conductores (aprobar/rechazar registro)
- Control total del ciclo de vida de pedidos

### 👤 Cliente Web
- Cotización dinámica en mapa con rutas reales (OSRM)
- Modo Normal vs Express (+50% precio)
- Tracking de pedido en tiempo real
- 💬 Chat en vivo con el conductor
- ETA dinámico basado en tráfico
- Historial de pedidos + Comprobantes PDF
- Compartir estado por WhatsApp

### 🤖 Funcionalidades Innovadoras
- **ETA con IA**: Tiempo estimado calculado con factores reales de tráfico de Arequipa (hora pico mañana, almuerzo, hora pico tarde, noche) más factor de zona y urgencia
- **Chat en vivo**: Comunicación en tiempo real entre cliente y conductor via Socket.io con historial persistente

### 🛵 App Repartidor (Flutter)
- Lista de pedidos disponibles y asignados
- Flujo: Aceptar → Iniciar Ruta → Entregar
- Mapa con navegación de ruta real
- Cámara para foto de evidencia de entrega

---

## 📈 Flujo de Estados

```
PENDIENTE → ASIGNADO → EN_CAMINO → ENTREGADO
    │           │           │           │
    ▼           ▼           ▼           ▼
  Email      Notif.    Tracking +     PDF
 Cliente    Conductor  ETA + Chat   Generado
```

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Diagrama ASCII y descripción de componentes |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Guía completa paso a paso para redes/infra |
| [`docs/OPERACION.md`](docs/OPERACION.md) | Logs, backups, reinicios y rollback |
| [`docs/CONTINUIDAD.md`](docs/CONTINUIDAD.md) | Cómo continuar el desarrollo |

---

## 🎨 Paleta de Colores

| Color | Hex | Uso |
|-------|-----|-----|
| Rojo URBSEND | `#D71920` | Primario |
| Azul Oscuro | `#2C3E50` | Secundario |
| Verde Éxito | `#16a34a` | Estados positivos |
| Naranja | `#f59e0b` | Alertas / Express |
| WhatsApp | `#25D366` | Botones compartir |

---

## 📄 Licencia

Este proyecto es propietario de URBSEND. Todos los derechos reservados.
