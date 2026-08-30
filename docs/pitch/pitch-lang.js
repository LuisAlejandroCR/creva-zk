// docs/pitch/pitch-lang.js
// Traducción de la página de pitch por diccionario, no por HTML duplicado: cada
// entrada empareja el innerHTML español exacto con su equivalente inglés. El
// jurado lee inglés y la usuaria lee español, y dos copias del marcado se
// desincronizan al primer cambio.
(function () {
  var EN = {
    'Pedir una tarjeta<em>sin entregar tu vida.</em>':
      'Apply for a card<em>without handing over your life.</em>',
    '· Midnight Hackathon · Agosto 2026 · MLH':
      '· Midnight Hackathon · August 2026 · MLH',
    'La demo, sin cortes': 'The demo, uncut',
    'Ochenta y seis segundos<br>de app real.': 'Eighty-six seconds<br>of the real app.',
    'Un primitivo, dos momentos': 'One primitive, two moments',
    'Verificar una atestación firmada,<br>evaluar el predicado,<br>divulgar solo el desenlace.':
      'Verify a signed attestation,<br>evaluate the predicate,<br>disclose only the outcome.',
    'La frontera de divulgación': 'The disclosure boundary',
    'Lo que sigue siendo suyo.': 'What stays hers.',
    'Medido, no estimado': 'Measured, not estimated',
    'Y un resultado<br>que contradijo la hipótesis.': 'And a result<br>that contradicted the hypothesis.',
    'Cuando algo falta': 'When something is missing',
    'Decirlo, en vez de<br>inventarse una respuesta.': 'Say so, instead of<br>inventing an answer.',
    'Trabajo previo, declarado': 'Prior work, declared',
    'Qué existía antes<br>y qué se escribió aquí.': 'What existed before<br>and what was written here.',
    'Identidad': 'Identity',
    'Respaldo': 'Backing',
    'PRUEBA 1': 'PROOF 1',
    'PRUEBA 2': 'PROOF 2',
    'Desliza ↓': 'Scroll ↓',
    'Nunca sale del dispositivo': 'Never leaves the device',
    'Lo único que se divulga': 'The only thing disclosed',
    'El documento de identidad': 'The ID document',
    'La biometría': 'The biometrics',
    'El RFC': 'The tax ID',
    'El saldo y el monto del colateral': 'The balance and the collateral amount',
    'La llave del sujeto y la firma del emisor': 'The subject key and the issuer signature',
    'Identidad: un booleano': 'Identity: one boolean',
    'Respaldo: un tramo — Bronce, Plata u Oro': 'Backing: a tier — Bronze, Silver or Gold',
    'Un contador de llamadas, sin sujeto ni desenlace': 'A call counter, carrying no subject and no outcome',
    'Falta la cartera': 'No wallet',
    'Cartera bloqueada': 'Wallet locked',
    'Red equivocada': 'Wrong network',
    'Servidor local caído': 'Local server down',
    'Falta un dato de la app': 'The app is missing a setting'
  };

  // Párrafos largos, emparejados por un fragmento inicial que no se repite.
  var LONG = [
    ['Una emprendedora pide una tarjeta colateralizada',
     'An entrepreneur applies for a collateralized card and sees what she qualifies for <b>without handing anyone her ID or her balance</b>. Two zero-knowledge proofs on Midnight, generated on her own phone.'],
    ['Nada de esto es una maqueta',
     'None of this is a mockup. The waits you see are proofs actually being generated; not one frame was sped up, because that wait <b>is</b> the guarantee.'],
    ['Las dos verifican la firma del emisor',
     'Both verify the issuer signature <b class="gold">inside the circuit</b>, before looking at the contents. Compact 0.31.1 ships no signature primitive, so the Schnorr-over-Jubjub comes from Midnight official example — and the signer obtains the challenge <b>by calling the contract itself</b>, never by reimplementing its hash.'],
    ['El desenlace de identidad',
     'The identity outcome is <b>never anchored</b>. A public record saying "this key was verified" would be exactly the linkable trail the product promises not to leave.'],
    ['Este repositorio afirmaba que verificar una firma',
     'This repository asserted that verifying a signature inside the circuit would make the identity proof slower. That was an argument, not a measurement. The measurement disagreed.'],
    ['Toda dependencia externa devuelve',
     'Every external dependency returns a typed result, never an exception. And none of these screens says she failed — because nobody checked anything.'],
    ['Entregado al track <b>Integrate Midnight</b>',
     'Submitted to the <b>Integrate Midnight</b> track, where prior work is allowed when declared. Creva, the platform, already existed: this repository <b>contains none of its code</b> and consumes it as an external system, behind a single adapter. What was written during the event is the Compact circuit, the witnesses, the Midnight client, the interface and the anchoring port.']
  ];

  // Sustituciones parciales: el número se queda, la etiqueta cambia.
  var PARTS = [
    ['2</b> predicados en circuito', '2</b> in-circuit predicates'],
    ['743</b> pruebas automatizadas', '743</b> automated tests'],
    ['23.7 s</b> por prueba, medido', '23.7 s</b> per proof, measured'],
    ['Contrato vivo en <b>preprod</b>', 'Live contract on <b>preprod</b>']
  ];

  var nodes = document.querySelectorAll('h1,h2,h3,p,b,span,div,li,em');
  var originals = new Map();
  nodes.forEach(function (el) { originals.set(el, el.innerHTML); });

  function toEnglish() {
    nodes.forEach(function (el) {
      var html = originals.get(el);
      if (html === undefined) return;
      var key = html.trim();
      if (EN[key] !== undefined) { el.innerHTML = EN[key]; return; }
      var i;
      for (i = 0; i < LONG.length; i += 1) {
        if (key.indexOf(LONG[i][0]) !== -1) { el.innerHTML = LONG[i][1]; return; }
      }
      for (i = 0; i < PARTS.length; i += 1) {
        if (key.indexOf(PARTS[i][0]) !== -1) {
          el.innerHTML = key.replace(PARTS[i][0], PARTS[i][1]);
          return;
        }
      }
    });
    document.documentElement.lang = 'en';
  }

  function toSpanish() {
    nodes.forEach(function (el) {
      var html = originals.get(el);
      if (html !== undefined) el.innerHTML = html;
    });
    document.documentElement.lang = 'es-MX';
  }

  var buttons = document.querySelectorAll('.lang button');

  function apply(lang) {
    if (lang === 'en') { toEnglish(); } else { toSpanish(); }
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    try { localStorage.setItem('creva-zk-pitch-lang', lang); } catch (e) { /* modo privado */ }
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { apply(b.dataset.lang); });
  });

  // Preferencia guardada primero; si no hay, la del navegador. Un jurado que
  // llega en inglés no debería tener que buscar el conmutador.
  var saved = null;
  try { saved = localStorage.getItem('creva-zk-pitch-lang'); } catch (e) { /* ignorado */ }
  var initial = saved || ((navigator.language || 'es').slice(0, 2) === 'es' ? 'es' : 'en');
  if (initial === 'en') { apply('en'); }
})();
