'use strict';

const SIGLAS_VALIDAS = ['AM', 'BA', 'BAR', 'MA', 'PE', 'PEB'];
const ORDEM_FILIAIS  = ['AM', 'BA', 'BAR', 'MA', 'PE', 'PEB'];

/** Extrai a UF do endereço (último campo antes de "Brazil"). */
function extrairUF(endereco) {
  if (!endereco) return null;
  const idx = endereco.search(/Brazil/i);
  if (idx < 0) return null;
  const antes = endereco.slice(0, idx);
  const partes = antes.split(',').map(p => p.trim()).filter(Boolean);
  if (!partes.length) return null;
  return partes[partes.length - 1].toUpperCase();
}

/** Resolve filial PA a partir do município no endereço. */
function resolverMunicipioPA(endereco) {
  const up = String(endereco || '').toUpperCase().replace(/[.\-\s]/g, '');
  if (up.includes('BARCARENA')) return 'BAR';
  if (up.includes('PARAUAPEBAS') ||
      up.includes('PAUAPEBA')    ||
      up.includes('CARAJAS'))    return 'PEB';
  return null;
}

/**
 * GPS: filial extraída do endereço.
 * - UF válida como sigla (AM, BA, MA, PE) → usa direto
 * - UF = PA → resolve por município (BAR / PEB)
 * - Qualquer outro → null (não localizado)
 */
function filialDoEndereco(endereco) {
  const uf = extrairUF(endereco);
  if (!uf) return null;
  if (uf === 'PA') return resolverMunicipioPA(endereco);
  if (SIGLAS_VALIDAS.includes(uf)) return uf;
  return null;
}

/**
 * DVR: filial a partir do LOCALIZADO da alocação.
 * Converte BAH→BA, PER→PE e valida contra as siglas permitidas.
 */
function normalizarFilialDVR(valor) {
  if (!valor) return null;
  const v = String(valor).trim().toUpperCase();
  if (v === 'BAH') return 'BA';
  if (v === 'PER') return 'PE';
  if (SIGLAS_VALIDAS.includes(v)) return v;
  return null;
}