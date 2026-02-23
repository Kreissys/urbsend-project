# OPERACIÓN - URBSEND
> Guía para operar el sistema en producción: logs, reinicios, backups y actualizaciones.

---

## Estado del sistema

```bash
# Ver todos los servicios
pm2 status
docker-compose ps

# Resumen rápido de salud
pm2 status && docker-compose ps && curl -s http://localhost:3001/api/orders | head -c 100
```

---

## Logs

### Backend (Node.js / PM2)
```bash
# Ver logs en tiempo real
pm2 logs urbsend-backend

# Ver últimas 100 líneas
pm2 logs urbsend-backend --lines 100

# Ver solo errores
pm2 logs urbsend-backend --err

# Logs guardados en disco
cat ~/.pm2/logs/urbsend-backend-out.log   # logs normales
cat ~/.pm2/logs/urbsend-backend-error.log # logs de error
```

### Base de datos (Docker / PostgreSQL)
```bash
# Ver logs de PostgreSQL
docker-compose logs db

# Logs en tiempo real
docker-compose logs -f db
```

### Nginx
```bash
# Logs de acceso
sudo tail -f /var/log/nginx/access.log

# Logs de error
sudo tail -f /var/log/nginx/error.log
```

---

## Reinicios

### Reiniciar solo el backend
```bash
pm2 restart urbsend-backend
```

### Reiniciar la base de datos
```bash
docker-compose restart db
# Esperar ~10 segundos antes de reiniciar el backend
pm2 restart urbsend-backend
```

### Reiniciar Nginx
```bash
sudo systemctl restart nginx
```

### Reiniciar todo el sistema
```bash
docker-compose restart db
sleep 10
pm2 restart urbsend-backend
sudo systemctl restart nginx
```

---

## Backups

### Backup de la base de datos
```bash
# Crear backup manual
docker exec urbsend-project_db_1 pg_dump -U user_urbsend urbsend_db > backup_$(date +%Y%m%d_%H%M).sql

# Guardar en carpeta de backups
mkdir -p ~/backups/urbsend
docker exec urbsend-project_db_1 pg_dump -U user_urbsend urbsend_db > ~/backups/urbsend/backup_$(date +%Y%m%d_%H%M).sql
```

### Backup automático (cron job diario a las 2am)
```bash
crontab -e
# Agregar esta línea:
0 2 * * * docker exec urbsend-project_db_1 pg_dump -U user_urbsend urbsend_db > ~/backups/urbsend/backup_$(date +\%Y\%m\%d).sql
```

### Backup de fotos de entrega (uploads/)
```bash
tar -czf ~/backups/urbsend/uploads_$(date +%Y%m%d).tar.gz /ruta/proyecto/backend/uploads/
```

---

## Restauración de backup

```bash
# Restaurar base de datos desde archivo SQL
docker exec -i urbsend-project_db_1 psql -U user_urbsend urbsend_db < ~/backups/urbsend/backup_20260209.sql
```

---

## Actualización del código (pull + restart)

```bash
# 1. Ir al directorio del proyecto
cd /ruta/al/proyecto/urbsend-project

# 2. Descargar cambios del repositorio
git pull origin master

# 3. Actualizar dependencias del backend (si hubo cambios en package.json)
cd backend && npm install

# 4. Aplicar migraciones nuevas (si hubo cambios en schema.prisma)
npx prisma migrate deploy

# 5. Reiniciar backend
pm2 restart urbsend-backend

# 6. Rebuild del frontend (si hubo cambios en frontend/)
cd ../frontend && npm install && npm run build

# 7. Nginx sirve automáticamente el nuevo build (no requiere reinicio)
```

---

## Rollback (volver a versión anterior)

```bash
# Ver tags disponibles
git tag

# Volver a tag anterior
git checkout v1.0-entrega

# Reinstalar dependencias y reiniciar
cd backend && npm install
pm2 restart urbsend-backend

# Frontend
cd ../frontend && npm install && npm run build
```

---

## Monitoreo

```bash
# Ver uso de CPU y memoria del backend
pm2 monit

# Ver uso de disco
df -h

# Ver uso de memoria del sistema
free -h

# Ver procesos más pesados
top
```
