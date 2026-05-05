// src/lib/sessionEvents.js
//
// Event bus minimalista pra comunicar "sessão admin expirou" entre o
// fetch wrapper (api.js) e o componente que renderiza o modal
// (SessionExpiredModalV2). Sem lib externa, sem context — só
// EventTarget nativo.
//
// Por que via evento e não chamada direta:
//   - api.js não conhece (e não deve conhecer) componentes React.
//   - Múltiplos consumidores podem reagir (modal + telemetria, futuro).
//   - Idempotente: várias calls paralelas que 401am no mesmo
//     instante disparam eventos múltiplos, mas o modal só renderiza
//     uma vez (state booleano no listener).

const target = new EventTarget();
const SESSION_EXPIRED_EVENT = "hypr:session-expired";

export function emitSessionExpired() {
  target.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function onSessionExpired(handler) {
  target.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => target.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}
