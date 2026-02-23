# DESPLIEGUE - URBSEND
> Guía paso a paso para el equipo de redes/infra. El sistema debe poder levantarse sin asistencia del desarrollador siguiendo este documento.

---

## Requisitos del Servidor

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disco | 10 GB | 20 GB |
| SO | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

### Puertos que usa el sistema

| Puerto | Servicio |
|--------|---------|
| 5173 | Frontend (dev) o 80/443 (prod con Nginx) |
| 3001 | Backend API + WebSocket |
| 5432 | PostgreSQL |

---

## Paso 1 — Instalar dependencias en el servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar versión
node -v  # debe mostrar v18.x o superior
npm -v

# Instalar Docker y Docker Compose
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# Instalar PM2 (para mantener el backend corriendo)
sudo npm install -g pm2

# Instalar Nginx (para exponer el frontend)
sudo apt install -y nginx
```

---

## Paso 2 — Obtener el código

```bash
# Clonar repositorio oficial
git clone https://github.com/[REPO_OFICIAL]/urbsend-project.git

# Entrar al proyecto
cd urbsend-project

# Hacer checkout del tag de entrega
git checkout v1.0-entrega
```

---

## Paso 3 — Configurar variables de entorno

### Para Docker (base de datos):
```bash
# En la raíz del proyecto
cp .env.example .env
nano .env
```
Completar:
```
POSTGRES_USER=user_urbsend
POSTGRES_PASSWORD=TU_CONTRASEÑA_SEGURA
POSTGRES_DB=urbsend_db
```

### Para el Backend:
```bash
cd backend
cp .env.example .env
nano .env
```
Completar:
```
DATABASE_URL="postgresql://user_urbsend:TU_CONTRASEÑA_SEGURA@localhost:5432/urbsend_db"
PORT=3001
EMAIL_USER=tucorreo@gmail.com
EMAIL_PASS=tu_app_password
```

---

## Paso 4 — Levantar la base de datos

```bash
# Desde la raíz del proyecto
cd urbsend-project
docker-compose up -d

# Verificar que PostgreSQL está corriendo
docker-compose ps
# Debe mostrar: urbsend-project_db_1   Up   0.0.0.0:5432->5432/tcp
```

---

## Paso 5 — Instalar dependencias y migrar BD

```bash
# Backend
cd backend
npm install

# Ejecutar migraciones (crea las tablas en PostgreSQL)
npx prisma migrate deploy

# Verificar que las tablas se crearon
npx prisma studio  # abre interfaz visual en puerto 5555 (opcional)
```

---

## Paso 6 — Levantar el Backend con PM2

```bash
# Desde la carpeta backend/
pm2 start index.js --name urbsend-backend

# Verificar que está corriendo
pm2 status
# Debe mostrar: urbsend-backend | online

# Guardar configuración para que reinicie automáticamente
pm2 save
pm2 startup
# Ejecutar el comando que PM2 te muestre (empieza con sudo env PATH=...)
```

---

## Paso 7 — Build y despliegue del Frontend

```bash
# Desde la carpeta frontend/
cd ../frontend
npm install
npm run build
# Genera la carpeta dist/ con los archivos estáticos
```

---

## Paso 8 — Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/urbsend
```

Pegar la siguiente configuración:
```nginx
server {
    listen 80;
    server_name TU_DOMINIO_O_IP;

    # Frontend (React build)
    root /ruta/al/proyecto/urbsend-project/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket para chat
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Uploads (fotos de entrega)
    location /uploads/ {
        proxy_pass http://localhost:3001;
    }
}
```

```bash
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/urbsend /etc/nginx/sites-enabled/
sudo nginx -t   # verificar que no hay errores de sintaxis
sudo systemctl restart nginx
```

---

## Paso 9 — Verificación Final

```bash
# 1. Verificar PostgreSQL
docker-compose ps

# 2. Verificar Backend
curl http://localhost:3001/api/orders
# Debe responder con [] o lista de pedidos en JSON

# 3. Verificar Frontend
curl http://localhost:80
# O abrir el navegador en http://TU_IP

# 4. Verificar PM2
pm2 status
```

Credenciales de prueba para validar:
- **Admin**: admin@urbsend.com / admin123
- **Conductor**: juan@urbsend.com / moto123

---

## Problemas comunes

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| `Error: connect ECONNREFUSED 5432` | PostgreSQL no levantó | `docker-compose up -d` y esperar 10 seg |
| `Cannot find module` en backend | Faltan dependencias | `cd backend && npm install` |
| Frontend muestra pantalla en blanco | Build incorrecto o ruta Nginx mal | Verificar ruta en `root` del nginx.conf |
| Chat no conecta (WebSocket) | Nginx no hace proxy de socket.io | Verificar bloque `location /socket.io/` en Nginx |
| `Prisma: table not found` | Migraciones no aplicadas | `npx prisma migrate deploy` |
