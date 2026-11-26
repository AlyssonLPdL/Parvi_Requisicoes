'use strict';

const LS_KEY_ALOC = 'gpsdvr_alocacao_v1';
const LS_KEY_RET  = 'gpsdvr_retidos_v1';
const LS_KEY_MOT  = 'gpsdvr_motoristas_v1';
const LS_KEY_VEND = 'gpsdvr_vendidos_v1'; // NOVO
const LS_TTL_MS   = 7 * 24 * 60 * 60 * 1000; // 7 dias

function salvarInsumos(alocacaoTexto, retidosTexto, motoristasTexto, vendidosTexto) {
  const agora = Date.now();
  localStorage.setItem(LS_KEY_ALOC, JSON.stringify({ texto: alocacaoTexto, ts: agora }));
  localStorage.setItem(LS_KEY_RET,  JSON.stringify({ texto: retidosTexto,  ts: agora }));
  localStorage.setItem(LS_KEY_MOT,  JSON.stringify({ texto: motoristasTexto, ts: agora }));
  localStorage.setItem(LS_KEY_VEND, JSON.stringify({ texto: vendidosTexto || '', ts: agora })); // NOVO
}

function lerInsumo(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { texto: '', ts: 0, idadeMs: Infinity, vencido: true, existe: false };
    const obj = JSON.parse(raw);
    const idadeMs = Date.now() - (obj.ts || 0);
    return {
      texto: obj.texto || '',
      ts: obj.ts || 0,
      idadeMs,
      vencido: idadeMs > LS_TTL_MS,
      existe: true
    };
  } catch {
    return { texto: '', ts: 0, idadeMs: Infinity, vencido: true, existe: false };
  }
}

function carregarInsumos() {
  return {
    alocacao: lerInsumo(LS_KEY_ALOC),
    retidos:  lerInsumo(LS_KEY_RET),
    motoristas: lerInsumo(LS_KEY_MOT),
    vendidos: lerInsumo(LS_KEY_VEND) // NOVO
  };
}

function textoAlarmeInsumo(nome, info) {
  if (!info.existe) return null;
  const dias = Math.floor(info.idadeMs / (24 * 3600 * 1000));
  if (info.vencido) {
    return nome + ': vencido (salvo há ' + dias + ' dia(s)). Recolar e salvar.';
  }
  if (info.idadeMs > 5 * 24 * 3600 * 1000) {
    const restam = Math.max(0, 7 - dias);
    return nome + ': vence em ~' + restam + ' dia(s).';
  }
  return null;
}
