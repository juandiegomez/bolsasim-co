# ADR-0006: identidad local sin autenticación

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

La primera versión es una demo local de un usuario. Implementar cuentas distraería de los recorridos financieros.

## Decisión

Resolver un usuario fijo configurado mediante `CurrentUserProvider`. Los casos de uso siempre reciben una identidad y verifican ownership, aunque el adapter local retorne la misma. No exponer la demo públicamente.

## Consecuencias

La frontera permite sustituir identidad posteriormente. Antes de despliegue multiusuario se requiere otro ADR, autenticación, autorización, aislamiento y migración de ownership.
