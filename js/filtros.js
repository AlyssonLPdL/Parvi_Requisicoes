'use strict';

/* ===== Limites (pontos que podem precisar ajuste) ===== */
const LIMITE_HORAS_GPS = 60;
const LIMITE_HORAS_DVR = 12; // se a fonte já filtra 48h e você quiser espelhar, troque aqui

function buscarAlocacao(alocacao, veiculo) {
  for (const a of alocacao) if (a.ordem === veiculo) return a;
  return null;
}

function estaRetido(retidos, veiculo) {
  return retidos.indexOf(veiculo) !== -1;
}

/** Existe chamado com código X e Data Resolução vazia? */
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

  // 2. Alocação (verificar se existe)
  //    Obs.: se GPS não deve exigir alocação, remover este bloco.
  const aloc = buscarAlocacao(ctx.alocacao, veic.veiculo);
  if (!aloc) {
    return { ...base, horas, aprovado: false, etapa: 'alocacao', motivo: 'Não alocado' };
  }

  // 3. Filial (do endereço)
  const filial = filialDoEndereco(veic.localizacao);
  if (!filial) {
    return { ...base, horas, aprovado: false, etapa: 'filial', motivo: 'Filial não localizada' };
  }

  // 4. Retidos
  if (estaRetido(ctx.retidos, veic.veiculo)) {
    return { ...base, horas, filial, aprovado: false, etapa: 'retidos', motivo: 'Retido' };
  }

  // 5. O.S.
  const aberto = chamadoAberto(ctx.chamados, veic.veiculo, 8);
  return {
    ...base,
    horas,
    tempoFormatado: formatarTempo(horas),
    filial,
    aprovado: true,
    etapa: 'ok',
    status: aberto ? 'Aberto' : 'Abrir',
    motivo: aberto ? 'Chamado aberto' : 'Abrir O.S.'
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

  // 2. Alocação
  const aloc = buscarAlocacao(ctx.alocacao, veic.veiculo);
  if (!aloc) {
    return { ...base, horas, aprovado: false, etapa: 'alocacao', motivo: 'Não alocado' };
  }

  // 3. Filial (do LOCALIZADO)
  const filial = normalizarFilialDVR(aloc.localizado);
  if (!filial) {
    return { ...base, horas, aprovado: false, etapa: 'filial', motivo: 'Filial não localizada' };
  }

  // 4. Retidos
  if (estaRetido(ctx.retidos, veic.veiculo)) {
    return { ...base, horas, filial, aprovado: false, etapa: 'retidos', motivo: 'Retido' };
  }

  // 5. O.S.
  const aberto = chamadoAberto(ctx.chamados, veic.veiculo, 7);
  return {
    ...base,
    horas,
    tempoFormatado: formatarTempo(horas),
    filial,
    aprovado: true,
    etapa: 'ok',
    status: aberto ? 'Aberto' : 'Abrir',
    motivo: aberto ? 'Chamado aberto' : 'Abrir O.S.'
  };
}