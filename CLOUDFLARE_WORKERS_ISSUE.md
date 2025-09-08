# Cloudflare Workers - ReferenceError: require is not defined

## Problema Principal

Al desplegar una aplicación React Router 7 con React 19 en Cloudflare Workers, se produce el error:

```
ReferenceError: require is not defined
```

## Causa Raíz

Cloudflare Workers **NO soportan** `require()` de CommonJS. Solo soportan módulos ES (`import/export`). El error ocurre por:

1. **React 19 + SSR**: React 19 usa `react-dom/server.browser` por defecto, que incluye dependencias de Node.js que usan `require()`
2. **Face-api.js**: Esta librería usa TensorFlow.js internamente, que contiene código CommonJS con `require()` calls
3. **Node.js modules**: El bundler incluye módulos como `node:perf_hooks`, `node:events`, `node:stream` que no existen en Workers

## Intentos de Solución (FALLIDOS)

### ❌ Configuración Vite básica
```js
define: {
  'require': 'undefined',
  'global': 'globalThis',
}
```
**Resultado**: No funciona porque el problema está en el bundling, no en runtime.

### ❌ Externa de dependencias
```js
build: {
  rollupOptions: {
    external: ['face-api.js', 'node:*']
  }
}
```
**Resultado**: Cloudflare plugin no permite `external` en SSR environment.

### ❌ Plugin personalizado para remover imports
```js
const removeNodeImports = () => ({
  name: 'remove-node-imports',
  generateBundle(options, bundle) {
    // Remover imports de Node.js
  }
})
```
**Resultado**: Parcialmente funciona pero React Router sigue generando los imports problemáticos.

## Solución Documentada (React Router 7)

Según la documentación oficial de React Router 7 con Cloudflare Workers:

```js
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      'react-dom/server': 'react-dom/server.edge',
    },
  },
})
```

**Propósito**: Usa la versión edge-compatible de React DOM server rendering en lugar de la versión browser que requiere Node.js APIs.

## Estado Actual

- ✅ Build se completa sin errores
- ✅ Bundle del servidor no contiene imports de Node.js visibles
- ❌ **Error persiste en runtime**: `require is not defined`

## Hipótesis del Problema Actual

El error podría venir de:

1. **Bundle interno**: Aunque el `index.js` se ve limpio, los assets bundleados (`app-*.js`, `server-build-*.js`) podrían contener `require()` calls internos
2. **Face-api.js**: A pesar de cargarse via CDN, el hook `useLiveness` sigue haciendo `await import("face-api.js")` lo que podría estar causando el problema
3. **React 19 incompatibilidad**: Posible bug conocido entre React 19 y Cloudflare Workers que requiere downgrade

## Próximos Pasos a Investigar

1. **Verificar bundles internos**: Buscar `require()` en todos los archivos `.js` del build
2. **Downgrade React**: Probar con React 18.x 
3. **Remover face-api completamente**: Eliminar todas las referencias y ver si el error persiste
4. **Template limpio**: Crear proyecto desde cero con template oficial de React Router + Cloudflare

## Archivos Relevantes

- `vite.config.ts` - Configuración de build
- `app/root.tsx` - Carga face-api.js via CDN
- `app/components/liveness/useLiveness.ts` - Hook que usa face-api
- `build/server/index.js` - Entry point del worker (limpio)
- `build/server/assets/*` - Bundles que podrían contener el problema

## Comandos para Depurar

```bash
# Buscar require en todo el build
grep -r "require(" build/server/

# Ver logs detallados del worker
npx wrangler dev --local

# Verificar si el problema es face-api
# (eliminar temporalmente useLiveness del proyecto)
```

---

**Última actualización**: El problema persiste a pesar de múltiples intentos de solución. Se requiere investigación más profunda del bundling interno o considerar alternativas arquitecturales.