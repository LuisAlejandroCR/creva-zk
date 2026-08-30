Cómo desplegar los contratos —el de respaldo y el de identidad— desde el navegador, con la cartera
Lace de quien monta la demo, cuando no hay una máquina con Docker a mano para correr
`npm run demo --workspace api`. Es una herramienta de operador: cada contrato se despliega una
vez, cada despliegue cuesta tDUST de tu propia cartera y crea un contrato nuevo. La usuaria nunca
ve esta pantalla ni la puede alcanzar.

# Desplegar los contratos desde Lace

## Cuándo usar esto

La ruta `lace` **se une** a contratos que ya existen; nunca despliega uno sola. Son dos, y son
independientes:

- **respaldo**, con `VITE_BACKING_CONTRACT_ADDRESS`;
- **identidad**, con `VITE_IDENTITY_CONTRACT_ADDRESS` **y** `VITE_IDENTITY_ISSUER_KEY`.

Sin esas variables la ruta degrada `contract_not_found` en el paso correspondiente y no llega a
ninguna prueba real. El recorrido empieza por identidad, así que sin las dos de identidad degrada
en el primer paso. Hay dos maneras de conseguir esas direcciones:

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
   con un botón de copiado al lado. En el despliegue de identidad imprime **dos** campos: la
   dirección y la llave del emisor.

El presupuesto de tiempo del despliegue completo es de cinco minutos
(`DEFAULT_DEPLOY_TIMEOUT_MS` en `api/src/timeouts.ts`): más que la prueba (~19 s), más que los dos
minutos que se le dan a una persona para leer el diálogo de firma, más la confirmación de la red.
Si se agota, la pantalla dice `deploy_failed` — y avisa de revisar si el contrato llegó a
desplegarse antes de pagar otro, porque una transacción ya enviada puede confirmarse después.

## Qué hacer con la dirección (respaldo)

```bash
VITE_PORT_SOURCE=lace \
VITE_BACKING_CONTRACT_ADDRESS=<la dirección que imprimió la pantalla> \
  npm run build --workspace web
```

Guárdala antes de cerrar la pestaña. **No vuelvas a desplegar**: cada despliegue crea otro
contrato y cuesta tDUST otra vez.

## Qué hacer con los dos valores (identidad)

El despliegue de identidad imprime **dos** valores y hacen falta los dos:

```bash
VITE_PORT_SOURCE=lace \
VITE_IDENTITY_CONTRACT_ADDRESS=<la dirección que imprimió la pantalla> \
VITE_IDENTITY_ISSUER_KEY=<la llave del emisor, en la forma x:y> \
  npm run build --workspace web
```

### Por qué hacen falta las dos

El circuito `proveIdentity` verifica la firma del attestation contra la llave del emisor que le
pasa quien llama. Con la dirección pero sin la llave, la verificación de firma **aborta**: la
pantalla dice «todavía no se puede» sobre una identidad que sí era válida, que es el peor de los
dos errores posibles. Por eso el puerto degrada `contract_not_found` cuando falta cualquiera de
las dos, en vez de pagar por una prueba que ya sabe que no puede aclarar nada.

### El formato de la llave

`x:y`, **las dos coordenadas en decimal**, tal como la imprime la pantalla. Por ejemplo:

```
28336281903124990867587793011069573392383982287722241916350956173377953689573:39385640392217313770878525135509063452020585410343666726093009378539878503883
```

No es un punto comprimido en hexadecimal, y no lo será: en este repositorio nadie descomprime un
punto de la curva, así que una cadena hexadecimal aquí sería un valor que nadie podría volver a
convertir en el par `(x, y)` que toma el circuito. Un valor que no tenga esta forma se trata como
ausente —nunca como una llave distinta—, y la ruta degrada `contract_not_found`.

### Desde qué navegador

El attestation que firma el despliegue de identidad queda guardado como **estado privado** en el
navegador y la cartera con los que se desplegó, y es lo que lee la prueba después: solo el emisor
que lo firmó puede producir uno, y la llave secreta de ese emisor se genera en la página, no se
guarda en ninguna parte y muere con la llamada. Corre el recorrido desde ese mismo navegador y con
esa misma cartera.

Para que ese estado privado sobreviva a la recarga, la ruta de identidad —y solo ella— cierra su
almacén con una contraseña que se guarda en `localStorage` (`web/src/identityStore.ts`). La ruta
de respaldo mantiene la suya efímera, sin cambios.

Todos los datos del attestation son sintéticos: no pertenecen a ninguna persona y no se derivan de
ningún documento real.

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

En el puerto de identidad, además:

| Razón | Qué la produce |
| --- | --- |
| `contract_not_found` | Falta `VITE_IDENTITY_CONTRACT_ADDRESS`, falta `VITE_IDENTITY_ISSUER_KEY`, o no hay nada usable en esa dirección |
| `call_failed` | La firma del attestation no la aceptó el circuito, o la llamada no llegó a responder |

## Lo que esta herramienta no toca

El recorrido de la usuaria. Sin la variable y sin el parámetro, `main.ts` monta exactamente lo que
montaba antes, y el código de la herramienta ni siquiera se carga: vive detrás de un `import()`
dinámico que solo se alcanza cuando alguien la pidió.
