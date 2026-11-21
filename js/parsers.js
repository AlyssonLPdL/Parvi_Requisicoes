'use strict';

function normHeader(h) {
  return String(h || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[º°]/g, '')
    .trim();
}

function splitLinhas(texto) {
  return String(texto || '').split(/\r?\n/);
}

/* ---------------- ALOCAÇÃO ---------------- */
function parseAlocacao(texto) {
  const linhas = String(texto || "").split(/\r?\n/).filter(l => l.trim() !== "");
  if (linhas.length < 2) throw new Error("Alocação vazia ou sem cabeçalho.");

  const header = linhas[0].split("\t").map(h => h.trim().toUpperCase());
  let idxOrdem = -1, idxLocalizado = -1, idxPlaca = -1;

  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (h === "Nº ORDEM" || h === "N° ORDEM" || h === "NO ORDEM" || h === "Nº  ORDEM") idxOrdem = i;
    if (h === "LOCALIZADO") idxLocalizado = i;
    if (h === "PLACA") idxPlaca = i;
  }

  if (idxOrdem === -1 || idxLocalizado === -1) {
    throw new Error("Colunas 'Nº ORDEM' e/ou 'LOCALIZADO' não encontradas.");
  }

  const mapa = new Map();
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split("\t");
    if (cols.length <= idxOrdem) continue;
    
    const ordem = normalizarVeiculo(cols[idxOrdem]);
    if (!ordem) continue;
    
    const localizado = cols[idxLocalizado] ? cols[idxLocalizado].trim() : "";
    const placa = (idxPlaca !== -1 && cols[idxPlaca]) ? cols[idxPlaca].trim().toUpperCase() : "";
    
    mapa.set(ordem, {
      localizado_original: localizado,
      filial: normalizarFilialDVR(localizado), // <-- CORRIGIDO AQUI
      placa: placa,
      linha_original: linhas[i]
    });
  }
  return mapa;
}

/* ---------------- MOTORISTAS ---------------- */
function parseMotoristas(texto) {
  const linhas = String(texto || "").split(/\r?\n/).filter(l => l.trim() !== "");
  if (linhas.length < 2) return [];
  
  const motoristas = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split("\t");
    if (cols.length >= 3) {
      motoristas.push({
        filial: cols[0].trim(),
        matricula: cols[1].trim(),
        nome: cols[2].trim()
      });
    }
  }
  return motoristas;
}

/* ---------- RETIDOS ---------- */
function parseRetidos(texto) {
  const linhas = splitLinhas(texto);
  const out = [];
  let primeiraNaoVazia = true;

  for (const l of linhas) {
    const t = l.trim();
    if (!t) continue;
    if (primeiraNaoVazia) {
      primeiraNaoVazia = false;
      // pula cabeçalho (linha sem nenhum dígito)
      if (!/\d/.test(t)) continue;
    }
    const n = normalizarVeiculo(t);
    if (n) out.push(n);
  }
  return out;
}

/* ---------- GPS ---------- */
function parseGPS(texto) {
  const linhas = splitLinhas(texto).filter(l => l.trim());
  if (!linhas.length) return [];

  const header = linhas[0].split('\t').map(normHeader);
  const idxAgrup = header.findIndex(h => h.includes('AGRUPAMENTO'));
  const idxCoord = header.findIndex(h => h.includes('COORDENADAS'));
  const idxLoc   = header.findIndex(h => h.includes('LOCALIZA'));

  if (idxAgrup < 0 || idxCoord < 0) return [];

  const out = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split('\t');
    const veiculoOriginal = (cols[idxAgrup] || '').trim();
    const veiculo = normalizarVeiculo(veiculoOriginal);
    if (!veiculo) continue;
    out.push({
      veiculo,
      veiculoOriginal,
      tempoTexto: (cols[idxCoord] || '').trim(),
      localizacao: idxLoc >= 0 ? (cols[idxLoc] || '').trim() : ''
    });
  }
  return out;
}

/* ---------- DVR ---------- */
function parseDVR(texto) {
  const linhas = splitLinhas(texto);
  const out = [];

  for (let i = 0; i < linhas.length; i++) {
    const veicStr = linhas[i].trim();
    if (!veicStr) continue;

    // próxima linha não vazia = tempo
    let j = i + 1;
    while (j < linhas.length && !linhas[j].trim()) j++;
    if (j >= linhas.length) break;

    const tempoStr = linhas[j].trim();
    if (/\d{1,3}:\d{2}:\d{2}/.test(tempoStr)) {
      out.push({
        veiculo: normalizarVeiculo(veicStr),
        veiculoOriginal: veicStr,
        tempoTexto: tempoStr
      });
      i = j;
    }
  }
  return out;
}

/* ---------- CHAMADOS ---------- */
function parseChamados(texto) {
  const linhas = splitLinhas(texto).filter(l => l.trim());
  if (!linhas.length) return [];

  const header = linhas[0].split('\t').map(normHeader);
  const idxVeic   = header.findIndex(h => h === 'VEICULO');
  const idxCod    = header.findIndex(h => h.includes('COD') && h.includes('DESCRI'));
  const idxDataRes= header.findIndex(h => h.includes('DATA') && h.includes('RESOLU'));

  if (idxVeic < 0 || idxCod < 0) return [];

  const out = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split('\t');
    const veiculo = normalizarVeiculo(cols[idxVeic]);
    if (!veiculo) continue;

    const codRaw = String(cols[idxCod] || '').trim();
    const codM   = codRaw.match(/\d+/);
    const cod    = codM ? parseInt(codM[0], 10) : null;

    const drRaw = String(idxDataRes >= 0 ? (cols[idxDataRes] || '') : '').trim();
    const resolvida = !(drRaw === '' || drRaw === '-' || drRaw === '—' || drRaw === '–');

    out.push({ veiculo, codDescricao: cod, resolvida });
  }
  return out;
}
