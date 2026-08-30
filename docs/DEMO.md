Runbook literal para grabar la demo de Creva ZK: los pasos en el orden exacto en que se ejecutan,
el comando de cada uno y qué debe verse en pantalla al terminarlo. Está escrito para leerse en voz
alta mientras se graba, no para estudiarse antes. La ruta que se graba es `bridge`, y todos los
datos que aparecen en pantalla son sintéticos.

# Grabar la demo

## ⛔ Lee esto antes que nada: el candado de LevelDB

**`npm run serve --workspace api` y `npm run demo` NO pueden correr al mismo tiempo.**

El private-state de Midnight vive en una LevelDB con **lock exclusivo**. Un solo proceso puede
tenerla abierta. El segundo que lo intente muere así:

```
Database failed to open: IO error: lock midnight-level-db/LOCK
```

Ocurre en cuanto el segundo proceso intenta desplegar — no al arrancar, así que el servidor puede
parecer sano durante minutos y caerse en la primera petición del navegador, que es exactamente el
momento en que la cámara está grabando.

**Cómo salir:**

1. Ctrl-C en el proceso sobrante y **espera a que salga solo**. El manejador de señales de
   `serve.ts` cierra el servidor HTTP, tumba el despliegue y suelta el lock en ese orden; si lo
   matas con `kill -9` no suelta nada.
2. Si el proceso murió mal y el lock quedó huérfano, borra la carpeta. Es estado local regenerable,
   está en `.gitignore` y no contiene nada que valga la pena conservar:

   ```bash
   rm -rf api/midnight-level-db
   ```

   (La carpeta se crea en el directorio de trabajo del proceso. Con `--workspace api` —y `npm run
   demo` también corre ahí— eso es `api/`.)
3. Vuelve a arrancar. El siguiente despliegue vuelve a pagar el arranque en frío.

Corolario para la grabación: **decide antes de empezar cuál de los dos vas a usar.** Para la ruta
que se graba, el que corre es `npm run serve --workspace api`. `npm run demo` es para desplegar una
vez fuera de cámara, no durante.

---

## 1. Antes de grabar: requisitos y cómo comprobar cada uno

Todo esto se hace **con la cámara apagada**. Ninguno de estos pasos sale en el video.

### 1.1 El semáforo, primero

```bash
npm run smoke
```

Tarda menos de un segundo y no arregla nada: solo dice si la demo va a funcionar. En verde:

```
OK    docker          el demonio responde (server 27.x.x)
OK    circuitos       los 3 compilados con .prover, .verifier y .bzkir
OK    artefactos web  N archivos, ~2.2 MB en web/public/zk/
OK    runtime         runtime: 1 copia — node_modules/@midnight-ntwrk/onchain-runtime-v3
OK    puertos         libres: 5173, 8787

smoke: verde — la demo puede grabarse.
```

Cada línea en rojo trae su arreglo al lado. Corre el arreglo, vuelve a correr `npm run smoke`, y no
sigas hasta que las cinco estén en verde.

### 1.2 Node

```bash
node -v
```

Debe imprimir **v24.11.1 o superior** (está en `.nvmrc` y en `engines` de `package.json`). Con una
versión menor, `npm install` avisa con un `EBADENGINE` y sigue adelante; el build es el que se cae
después. Si usas nvm: `nvm use`.

### 1.3 Docker

```bash
docker info --format '{{.ServerVersion}}'
```

Debe imprimir la versión del servidor. Si dice `Cannot connect to the Docker daemon`, arranca
Docker Desktop o `sudo systemctl start docker`. Esto es exactamente lo que comprueba la primera
línea de `npm run smoke`; se repite aquí porque es el requisito que más veces falta.

Docker no es opcional en ninguna ruta real: la red local `undeployed` son tres contenedores (nodo,
indexer, proof server) que levanta `testkit-js`.

### 1.4 Toolchain de Compact

Fijado en **0.31.1**. `0.34.0` exige ledger 9 y todavía no hay proof server estable para él.

```bash
compact --version        # la herramienta
compact update 0.31.1    # instala/fija el compilador
```

La comprobación que de verdad zanja el asunto es compilar:

```bash
npm run compact:build
```

Al terminar, `contract/src/managed/` debe tener las tres carpetas —`backing/`, `backing-tier/`,
`identity-check/`— cada una con `keys/*.prover`, `keys/*.verifier` y `zkir/*.bzkir`. No lo
verifiques a ojo: `npm run smoke` lo hace por ti y falla nombrando el circuito incompleto.

> Dos cosas que la documentación oficial no menciona y sin las cuales la instalación falla:
> `unzip` debe estar en el sistema, y npm 11 pide aprobar los install scripts por nombre
> (`npm install-scripts approve <pkg>`). Y una tercera, de campo: `compact update` consulta la API
> de GitHub, así que si tienes un `GITHUB_TOKEN` en el entorno que no es un token de GitHub válido,
> falla con `Bad credentials` — quítalo de esa invocación.

### 1.5 Artefactos servidos al navegador

```bash
npm run zk:copy --workspace web
```

Debe imprimir `[zk] copied N artifacts (2.2 MB) into web/public/zk/`. Ya corre solo desde `npm run dev` y
`npm run build` del workspace `web`, pero conviene correrlo a mano después de recompilar los
circuitos:
una clave vieja no falla al construir, falla dentro de la prueba.

### 1.6 `npm run verify` en verde

Este es el requisito que no se negocia.

```bash
npm run verify
```

Corre, en este orden: `check:runtime` → `compact:build` → `typecheck` → `test` → `build`. Compila
**antes** de typechequear a propósito: el compilador genera las APIs de TypeScript contra las que
compila el resto del repositorio, así que sin ese paso el typecheck no tiene contra qué compilar.

Al terminar debe decir que todos los tests pasaron y ningún workspace falló. Si `check:runtime`
grita `2 copias de onchain-runtime-v3`, el arreglo es `npm dedupe`: dos copias del runtime WASM son
dos clases `StateValue` distintas y **toda** llamada a circuito muere con
`expected instance of StateValue`.

### 1.7 Última pasada

Cierra todo lo que abriste durante la preparación —en particular cualquier `npm run demo` que haya
quedado vivo— y vuelve a correr `npm run smoke`. Las cinco líneas en verde es la señal de grabar.

---

## 2. La ruta que se graba: `bridge`

Dos terminales, en este orden. La primera antes que la segunda, siempre.

### Terminal 1 — el servidor de pruebas

```bash
npm run serve --workspace api
```

**Qué se debe ver:** una línea de pino con `proof server listening` y `"port": 8787`, más el
recordatorio `set VITE_PORT_SOURCE=bridge in web/`. El servidor **liga el puerto de inmediato**;
no despliega nada hasta la primera petición, así que verlo escuchando no significa todavía que la
red local esté arriba.

- **Puerto: 8787.** Es `DEFAULT_PROOF_SERVER_PORT` en `api/src/proofServer.ts`.
- **Si está ocupado:** el proceso arranca en otro puerto con `PROOF_SERVER_PORT=8801 npm run serve
  --workspace api`, y entonces **el navegador tiene que enterarse**: la terminal 2 necesita también
  `VITE_BRIDGE_URL=http://localhost:8801`. Sin eso el navegador sigue tocando 8787 y todas las
  pantallas degradan. Lo simple es liberar 8787: `lsof -ti :8787 | xargs kill`.

### Terminal 2 — la interfaz

```bash
VITE_PORT_SOURCE=bridge npm run dev --workspace web
```

**Qué se debe ver:** el banner de Vite con `Local: http://localhost:5173/`. Abre esa URL. La
pantalla 1 es "Solicita tu tarjeta", con el indicador `1 de 4` al pie.

- **Puerto: 5173**, el de Vite por defecto.
- **Si está ocupado:** Vite se mueve solo al siguiente libre y **lo imprime en el banner** — usa la
  URL que imprimió, no la que esperabas. Para fijarlo:
  `VITE_PORT_SOURCE=bridge npm run dev --workspace web -- --port 5174 --strictPort`.

### Qué pasa al pulsar el botón

La primera prueba de la sesión paga el arranque en frío de la red local (~52 s) **más** el
despliegue (~19,5 s) **más** la prueba. Las siguientes solo pagan la prueba: **~23,7 s medidos**
para respaldo (`tools/PROOF-LATENCY.md`). La de identidad verifica una firma Schnorr dentro del
circuito, así que tarda más; **cuánto más no está medido** y no hay que decir un número en cámara.

Mientras corre, la pantalla es el anillo de verificación con el tiempo transcurrido (`Llevamos
21 s`) y un solo paso nombrado. Pasado el tiempo medido, el titular cambia a `Estamos terminando`
y el anillo se queda corto a propósito: nada en pantalla dice "listo" antes de que llegue la
respuesta.

**Consejo de grabación:** haz una prueba completa **antes** de grabar, con el mismo proceso de la
terminal 1 que vas a usar en cámara. Así el despliegue ya está pagado y en el video la espera son
~24 s en vez de ~95 s. No reinicies la terminal 1 entre el ensayo y la toma buena: si la reinicias,
pierdes el despliegue (ver §5).

---

## 3. El candado de LevelDB (otra vez, porque duele)

Está arriba del todo, y se repite aquí porque es el único fallo de esta demo que aparece **en
mitad de la grabación** y no antes.

| Corriendo | ¿Puede correr a la vez que…? |
|---|---|
| `npm run serve --workspace api` | `npm run demo` → **NO** |
| `npm run serve --workspace api` | otro `npm run serve --workspace api` → **NO** |
| `npm run serve --workspace api` | `npm run dev --workspace web` → **sí** (Vite no toca la base) |
| `npm run demo` | otro `npm run demo` → **NO** |

El error, literal:

```
Database failed to open: IO error: lock midnight-level-db/LOCK
```

La salida, otra vez: Ctrl-C al proceso sobrante y esperar a que termine solo; si murió mal,
`rm -rf api/midnight-level-db`; y volver a arrancar.

Sobre `npm run demo:identity`: **no existe en este repositorio**. La prueba de identidad se ejerce
por el servidor de la terminal 1 (`/proof/identity`), que la despliega y la llama. Si alguien
añade un runner de identidad en el futuro, entra en la tabla de arriba con un **NO** en todas las
filas, por la misma razón que las demás.

---

## 4. Las cuatro pantallas degradadas de Lace

**Son parte de la demo, no un fallo.** Cada una es un resultado `degraded` tipado: *nadie pudo
revisar*, que no es lo mismo que *la respuesta es no*. Un rechazo real (`failed`) usa otras
palabras y nunca se mezcla con estas.

Estas cuatro pertenecen a la ruta **`lace`** (`VITE_PORT_SOURCE=lace`), la que habla con Midnight
desde el propio navegador. Se comprueban **en el orden de abajo**: la pantalla nombra siempre lo
primero que hay que arreglar, así que para ver la de más abajo hay que tener resueltas las de
arriba.

Copia verificada corriendo el puerto real (`createLaceBackingPort`) contra cada condición y
renderizando la pantalla con `buildBackingContent`. Las cuatro salen con CTA **`Reintentar`** y
fase `degraded`.

### 4.1 Falta la cartera — `wallet_absent`

**Cómo provocarla:** abre la página en un perfil de Chromium **sin la extensión Lace**, o
deshabilita Lace en `chrome://extensions` y recarga.

> **Falta la cartera**
> Este navegador no tiene ninguna cartera de Midnight instalada, así que nadie pudo comprobar nada.
> Instala Lace en su versión Midnight Preview y vuelve a intentarlo.

### 4.2 Cartera bloqueada — `wallet_locked`

**Cómo provocarla:** con Lace instalada, **bloquéala** (cierra sesión en la extensión) o rechaza el
diálogo de permiso que sale al pulsar el botón. Cualquier `connect()` que no devuelva una conexión
usable cae aquí.

> **Cartera bloqueada**
> Lace está instalada pero no entregó una conexión, así que nadie pudo revisar nada. Ábrela,
> desbloquéala, autoriza este sitio y vuelve a intentarlo.

### 4.3 Red equivocada — `wallet_wrong_network`

**Cómo provocarla:** desbloquea Lace y ponla en una red distinta de la que el build espera. Sin
tocar Lace, el mismo efecto sale con `VITE_LACE_NETWORK_ID=mainnet` al arrancar Vite: el build
pide una red que la cartera no reporta.

> **Red equivocada**
> Lace está conectada a otra red, así que nadie pudo revisar nada. Cámbiala a la red de prueba de
> Midnight (preprod) y vuelve a intentarlo.

El identificador que reporta cada build de Lace es lo único que este repositorio no puede zanjar
desde sus dependencias: se registra en la consola (`lace reported its connection status`) y se
ajusta con `VITE_LACE_NETWORK_ID`, sin tocar código.

### 4.4 El servidor local no responde — `proof_server_unreachable`

**Cómo provocarla:** con Lace desbloqueada y en la red correcta, **apaga el proof server local**:

```bash
docker compose -f api/proof-server-local.yml down
```

> **El servidor local no responde**
> No respondió el servidor que configuraste en Lace (Ajustes » Midnight » Local,
> http://localhost:6300). Ahí se genera todo, en tu propia computadora: sin él nadie pudo comprobar
> nada. Inícialo y vuelve a intentarlo.

Para volver a encenderlo:

```bash
docker compose -f api/proof-server-local.yml up
```

La sonda es una petición cross-origin real con `Content-Type: application/octet-stream`, así que un
servidor que está escuchando pero rechaza CORS **también** cae aquí — y bien: si no, pasaría la
sonda y moriría ~20 s después dentro del prover, culpando a lo que no es. La causa cruda va a la
consola (`local proof server probe failed`), nunca a la pantalla.

### 4.5 La quinta, la que no se provoca en cámara

Hay una quinta, `contract_not_found` → **"Falta un dato de esta app"**, para cuando el build no
trae `VITE_BACKING_CONTRACT_ADDRESS`. Es la única de la lista que no le pide nada a la usuaria: le
dice que avise a quien le compartió la app. No la uses como demostración de resiliencia — se lee
como una app mal instalada, porque eso es.

---

## 5. Si algo se cae a mitad

Lo primero: **qué proceso se cayó**. La respuesta cambia por completo según cuál.

### Se puede reiniciar sin perder nada

- **La pestaña del navegador.** Recargar pierde el estado del recorrido (en memoria), no el
  despliegue. Vuelve a empezar la pantalla 1 y la siguiente prueba tarda ~24 s, no ~95 s.
- **Vite (terminal 2).** Ctrl-C y volver a arrancarlo. No toca la base de datos, no toca el
  despliegue, no toca Docker. Es el reinicio barato.
- **Un `npm run smoke`.** No arranca nada; correrlo a mitad no interfiere. Ojo: si la terminal 1
  está viva, la línea de puertos dirá que 8787 está ocupado. Eso es correcto, no un fallo.

### Se pierde el despliegue

- **El servidor de pruebas (terminal 1).** Aquí vive todo: el despliegue está memoizado en el
  proceso, y el proceso es el que tiene el lock de LevelDB. Si lo matas, se va con él. Al volver a
  arrancar, la primera petición paga otra vez el arranque en frío (~52 s) más el despliegue
  (~19,5 s) más la prueba. **Si te pasa grabando: no vuelvas a grabar de inmediato.** Reinicia,
  haz una prueba de calentamiento fuera de cámara y luego repite la toma.
- **Los contenedores de Docker.** Si la terminal 1 murió mal, pueden quedar vivos. Compruébalo con
  `docker ps` y bórralos antes de reintentar; un nodo o un indexer huérfano hace fallar el
  siguiente arranque de forma difícil de leer.

### Si nada de eso lo explica

Vuelve al principio: **Ctrl-C a todo, `npm run smoke`, y no reintentes hasta tener las cinco líneas
en verde.** Reintentar sobre un entorno a medias es lo que convierte un fallo de un minuto en
veinte.

Y si el error que ves es `Database failed to open: IO error: lock midnight-level-db/LOCK`, no es
nada de esta sección: es §3, y la salida está ahí.
