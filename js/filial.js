'use strict';

const SIGLAS_VALIDAS = ['AM', 'BA', 'BAR', 'MA', 'PE', 'PEB'];
const ORDEM_FILIAIS  = ['AM', 'BA', 'BAR', 'MA', 'PE', 'PEB'];

/** Extrai a UF do endereço de forma inteligente (ignorando o CEP). */
function extrairUF(endereco) {
  if (!endereco) return null;
  const idx = endereco.search(/Brazil/i);
  if (idx < 0) return null;
  
  const antes = endereco.slice(0, idx);
  const partes = antes.split(',').map(p => p.trim()).filter(Boolean);
  if (!partes.length) return null;
  
  // Pega a última parte (ex: "PE 51350-670")
  const ultima = partes[partes.length - 1];
  
  // Pega apenas as 2 primeiras letras (a UF) e ignora o resto (CEP)
  const match = ultima.match(/^([A-Z]{2})\b/i);
  if (match) return match[1].toUpperCase();
  
  // Se vier só a UF sem número (ex: "PE")
  if (ultima.length === 2) return ultima.toUpperCase();
  
  return null;
}

/** Resolve filial PA a partir do município no endereço. */
function resolverMunicipioPA(endereco) {
  // Remove acentos e pontuações para facilitar a busca
  const up = String(endereco || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Cidades que são da filial PEB (Parauapebas / Carajás)
  if (up.includes('PARAUAPEBAS') || up.includes('CARAJAS') || up.includes('PAUAPEBA')) {
    return 'PEB';
  }
  
  // Cidades que são da filial BAR (Barcarena, Ananindeua, Abaetetuba, etc.)
  if (up.includes('BARCARENA') || up.includes('ANANINDEUA') || up.includes('ABAETETUBA')) {
    return 'BAR';
  }
  
  // Para qualquer outra cidade do PA que não seja PEB, assumimos BAR por segurança
  // (já que as únicas filiais do Pará são BAR e PEB)
  return 'BAR';
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
  
  if (uf === 'PA') {
    return resolverMunicipioPA(endereco);
  }
  
  if (SIGLAS_VALIDAS.includes(uf)) {
    return uf;
  }
  
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
