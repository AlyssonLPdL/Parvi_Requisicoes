'use strict';

const LIMITE_HORAS_GPS = 60;
const LIMITE_HORAS_DVR = 60;

function buscarAlocacao(alocacaoMap, veiculo) {
  if (!alocacaoMap || typeof alocacaoMap.get !== 'function') return null;
  return alocacaoMap.get(veiculo) || null;
}

function estaRetido(retidos, veiculo) {
  return retidos.indexOf(veiculo) !== -1;
}

function estaVendido(vendidos, veiculo) { // NOVO
  if (!vendidos) return false;
  return vendidos.indexOf(veiculo) !== -1;
}

function chamadoAberto(chamados, veiculo, codigo) {
  for (const c of chamados) {
    if (c.veiculo === veiculo && c.codDescricao === codigo && !c.resolvida) {
      return true;
    }
  }
  return false;
}

/* ==================== GPS ==================== */
function processarGPS(veic, ctx) {
  const base = {
    veiculo: veic.veiculo,
    veiculoOriginal: veic.veiculoOriginal,
    tempoTexto: veic.tempoTexto,
    localizacao: veic.localizacao
  };

  // 1. Tempo
  const data = parseDataGPS(veic.tempoTexto);
  const horas = horasDesde(data);
  if (horas == null || horas <= LIMITE_HORAS_GPS) {
    return { ...base, horas, aprovado: false, etapa: 'tempo',
             motivo: horas == null ? 'Data inválida' : 'Tempo ≤ ' + LIMITE_HORAS_GPS + 'h' };
  }

  // 2. Vendidos / Desmobilizados (NOVO)
  if (estaVendido(ctx.vendidos, veic.veiculo)) {
    return { ...base, horas, aprovado: false, etapa: 'vendido', motivo: 'Vendido / Desmobilizado' };
  }

  // 3. Alocação
  const aloc = buscarAlocacao(ctx.alocacao, veic.veiculo);
  if (!aloc) {
    return { ...base, horas, aprovado: false, etapa: 'alocacao', motivo: 'Não alocado' };
  }

  // 4. Filial
  const filial = filialDoEndereco(veic.localizacao);
  if (!filial) {
    return { ...base, horas, aprovado: false, etapa: 'filial', motivo: 'Filial não localizada' };
  }

  // 5. Retidos
  if (estaRetido(ctx.retidos, veic.veiculo)) {
    return { ...base, horas, filial, aprovado: false, etapa: 'retidos', motivo: 'Retido' };
  }

  // 6. O.S.
  const aberto = chamadoAberto(ctx.chamados, veic.veiculo, 8);
  if (aberto) {
    return { ...base, horas, filial, aprovado: false, etapa: 'os', motivo: 'Já aberto' };
  }

  return {
    ...base, horas, tempoFormatado: formatarTempo(horas), filial,
    aprovado: true, etapa: 'ok', status: 'Abrir', motivo: 'Abrir O.S.'
  };
}

/* ==================== DVR ==================== */
function processarDVR(veic, ctx) {
  const base = {
    veiculo: veic.veiculo,
    veiculoOriginal: veic.veiculoOriginal,
    tempoTexto: veic.tempoTexto
  };

  // 1. Tempo
  const horas = parseTempoDVR(veic.tempoTexto);
  if (horas == null || horas <= LIMITE_HORAS_DVR) {
    return { ...base, horas, aprovado: false, etapa: 'tempo',
             motivo: horas == null ? 'Tempo inválido' : 'Tempo ≤ ' + LIMITE_HORAS_DVR + 'h' };
  }

  // 2. Vendidos / Desmobilizados (NOVO)
  if (estaVendido(ctx.vendidos, veic.veiculo)) {
    return { ...base, horas, aprovado: false, etapa: 'vendido', motivo: 'Vendido / Desmobilizado' };
  }

  // 3. Alocação
  const aloc = buscarAlocacao(ctx.alocacao, veic.veiculo);
  if (!aloc) {
    return { ...base, horas, aprovado: false, etapa: 'alocacao', motivo: 'Não alocado' };
  }

  // 4. Filial
  const filial = normalizarFilialDVR(aloc.localizado_original);
  if (!filial) {
    return { ...base, horas, aprovado: false, etapa: 'filial', motivo: 'Filial não localizada' };
  }

  // 5. Retidos
  if (estaRetido(ctx.retidos, veic.veiculo)) {
    return { ...base, horas, filial, aprovado: false, etapa: 'retidos', motivo: 'Retido' };
  }

  // 6. O.S.
  const aberto = chamadoAberto(ctx.chamados, veic.veiculo, 7);
  if (aberto) {
    return { ...base, horas, filial, aprovado: false, etapa: 'os', motivo: 'Já aberto' };
  }

  return {
    ...base, horas, tempoFormatado: formatarTempo(horas), filial,
    aprovado: true, etapa: 'ok', status: 'Abrir', motivo: 'Abrir O.S.'
  };
}
