Cómo desplegar el contrato de respaldo desde el navegador, con la cartera Lace de quien monta la
demo, cuando no hay una máquina con Docker a mano para correr `npm run demo --workspace api`.
Es una herramienta de operador: se usa una vez, cuesta tDUST de tu propia cartera y crea un
contrato nuevo cada vez que se ejecuta. La usuaria nunca ve esta pantalla ni la puede alcanzar.

# Desplegar el contrato desde Lace

## Cuándo usar esto

La ruta `lace` **se une** a un contrato que ya existe; nunca despliega uno sola. Sin
`VITE_BACKING_CONTRACT_ADDRESS` la app degrada `contract_not_found` y no llega a ninguna prueba
real. Hay dos maneras de conseguir esa dirección:

| Camino | Qué hace falta | Cuándo conviene |
| --- | --- | --- |
| `npm run demo --workspace api` | Docker y la red local | Es el camino normal; también mide latencias |
| Esta herramienta | Solo Lace, con tDUST y su servidor de pruebas local | No hay Docker, o se quiere desplegar en preprod con la cartera propia |

## Requisitos

Los mismos de la ruta `lace` (ver `web/README.md`), más uno: la cartera necesita **tDUST** en
preprod, porque un despliegue se paga.

1. Lace en su versión Midnight Preview, desbloqueada y en la red de prueba (`preprod`).
2. El servidor de pruebas local que Lace configura en *Ajustes » Midnight » Local*
   (`http://localhost:6300`), encendido.
3. `npm run compact:build` y `npm run zk:copy --workspace web` ya ejecutados: el despliegue
   necesita las claves del circuito igual que una prueba.

## Cómo se enciende

La herramienta **nunca** está encendida por defecto y **nunca** se dispara sola al cargar la app.
Se pide de una de estas dos formas, y en ambas todavía hay que pulsar el botón:

```bash
# Por variable de build
VITE_PORT_SOURCE=lace VITE_LACE_DEPLOY=1 npm run dev --workspace web

# O, sobre una build que ya es 'lace', por parámetro de URL
http://localhost:5173/?deploy=1
```

Cualquier otro valor —`VITE_LACE_DEPLOY=0`, `?deploy=true`, la variable ausente— deja la app
exactamente como está: el recorrido normal de la usuaria, sin herramienta de operador en la
página. Hay pruebas que lo comprueban en `web/test/deployTool.test.ts`.

## Qué pasa al pulsar

En orden, y cada paso puede fallar por separado:

1. Se conecta Lace y se comprueba la red. Si falta la cartera, está bloqueada o está en otra red,
   la pantalla lo dice y no se despliega nada.
2. Se comprueba que el servidor de pruebas local responde.
3. Se construye la transacción de despliegue, se prueba en tu servidor local, **Lace pide firmar**
   y la red confirma. Esto tarda minutos, no segundos.
4. La pantalla imprime la dirección del contrato en un campo que se puede seleccionar y copiar,
   con un botón de copiado al lado.

El presupuesto de tiempo del despliegue completo es de cinco minutos
(`DEFAULT_DEPLOY_TIMEOUT_MS` en `api/src/timeouts.ts`): más que la prueba (~19 s), más que los dos
minutos que se le dan a una persona para leer el diálogo de firma, más la confirmación de la red.
Si se agota, la pantalla dice `deploy_failed` — y avisa de revisar si el contrato llegó a
desplegarse antes de pagar otro, porque una transacción ya enviada puede confirmarse después.

## Qué hacer con la dirección

```bash
VITE_PORT_SOURCE=lace \
VITE_BACKING_CONTRACT_ADDRESS=<la dirección que imprimió la pantalla> \
  npm run build --workspace web
```

Guárdala antes de cerrar la pestaña. **No vuelvas a desplegar**: cada despliegue crea otro
contrato y cuesta tDUST otra vez.

## Fallos posibles

Ninguno es una excepción: todos son degradados tipados, y todos son razones que ya existían en la
ruta `lace`. No se inventó ninguna para esta pantalla.

| Razón | Qué la produce |
| --- | --- |
| `wallet_absent` | No hay ninguna cartera de Midnight en este navegador |
| `wallet_locked` | Lace está instalada pero no entregó una conexión usable |
| `wallet_wrong_network` | Lace está conectada a otra red |
| `proof_server_unreachable` | El servidor de pruebas local no respondió |
| `deploy_failed` | Faltó tDUST, se rechazó la firma, o se agotó el presupuesto de tiempo |
| `contract_not_compiled` | Falta la salida de `npm run compact:build` en esta build |
| `environment_unavailable` | La build no es la de `VITE_PORT_SOURCE=lace` |

## Lo que esta herramienta no toca

El recorrido de la usuaria. Sin la variable y sin el parámetro, `main.ts` monta exactamente lo que
montaba antes, y el código de la herramienta ni siquiera se carga: vive detrás de un `import()`
dinámico que solo se alcanza cuando alguien la pidió.
