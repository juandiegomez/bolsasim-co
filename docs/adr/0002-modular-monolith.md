# ADR-0002: monolito modular para frontend y backend

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

La demo es local, de un usuario y cuatro slices. Servicios separados elevarían el costo operativo sin ofrecer aislamiento necesario.

## Decisión

Usar una aplicación Next.js desplegable como una unidad, con módulos `domain`, `application`, `infrastructure` y `presentation`. Los route handlers son adapters HTTP; casos de uso y dominio no dependen de Next.js. Toda comunicación UI-operación pasa por contratos de servidor.

## Consecuencias

Se comparte runtime y repositorio, con pruebas simples y menor latencia. Las fronteras se hacen cumplir por imports y tests arquitectónicos. Frontend, backend o autenticación podrán sustituirse conservando puertos y dominio.
