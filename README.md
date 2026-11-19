Proyecto Quiz-Cloud
## Stack Tecnológico
- **Frontend:** Nuxt 4, Vue 3, TypeScript, Tailwind CSS y Pinia (`apps/web`)
- **Backend:** Node.js, Express 5, TypeScript (`apps/api`)
- **Base de Datos:** PostgreSQL 16 con migraciones y datos iniciales (`database/`)
- **Contenedores y Nube:** Docker Compose (local), Render (API + PostgreSQL) y Netlify (Frontend)

## Ejecución en entorno local
1. Copiar variables de entorno: `cp .env.example .env`
2. Levantar servicios con Docker: `docker compose up --build`
3. Verificar salud de la API: `http://localhost:4000/api/health`
4. Abrir aplicación web: `http://localhost:3000`