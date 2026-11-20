'use strict';

/**
 * Parse "2d 01:10:26" ou "01:10:26" -> horas decimais.
 * Retorna null se não bater o formato.
 */
function parseTempoDVR(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(?:(\d+)\s*d\s*)?(\d{1,3}):(\d{2}):(\d{2})$/i);
  if (!m) return null;
  const dias = parseInt(m[1] || '0', 10);
  const h    = parseInt(m[2], 10);
  const mi   = parseInt(m[3], 10);
  const s    = parseInt(m[4], 10);
  if (mi > 59 || s > 59) return null;
  return dias * 24 + h + mi / 60 + s / 3600;
}

/**
 * Parse data/hora GPS.
 * Aceita: "2024-01-15 10:30:00", "2024-01-15T10:30", "15/01/2024 10:30:00".
 */
function parseDataGPS(str) {
  if (!str) return null;
  const s = String(str).trim();

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Horas decorridas desde uma data até agora. */
function horasDesde(data) {
  if (!data) return null;
  return (Date.now() - data.getTime()) / 3600000;
}

/**
 * Formata horas decimais -> "49h e 10min" / "49h".
 */
function formatarTempo(horas) {
  if (horas == null || isNaN(horas)) return '';
  const totalMin = Math.round(horas * 60);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (min === 0) return h + 'h';
  return h + 'h e ' + min + 'min';
}