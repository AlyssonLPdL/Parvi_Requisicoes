'use strict';

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function normalizarTexto(str) {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function realizarBusca() {
  const query = document.getElementById('input-busca').value.trim();
  const container = document.getElementById('resultado-busca');
  container.innerHTML = '';

  if (query.length < 2) return;

  const ins = carregarInsumos();
  const queryNorm = normalizarTexto(query);
  
  // 1. Tenta buscar por PLACA
  const isPlaca = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(query) || /^[A-Z]{3}[0-9]{4}$/i.test(query);
  
  if (isPlaca && ins.alocacao.texto) {
    try {
      const alocacaoMap = parseAlocacao(ins.alocacao.texto);
      let achou = false;
      
      for (const [veiculo, dados] of alocacaoMap.entries()) {
        if (dados.placa && dados.placa.toUpperCase().includes(query.toUpperCase())) {
          achou = true;
          renderResultadoBusca(container, `Placa Encontrada: ${dados.placa}`, [
            `<strong>Nº ORDEM:</strong> ${veiculo}`,
            `<strong>Filial:</strong> ${dados.filial || dados.localizado_original}`,
            `<div style="margin-top:8px; color:var(--text-muted); font-size:12px;">Linha Original da Alocação:</div>`,
            `<div style="word-break: break-all;">${dados.linha_original}</div>`
          ]);
        }
      }
      if (!achou) container.innerHTML = '<div class="vazio">Nenhuma placa encontrada na alocação.</div>';
      return;
    } catch(e) {
        console.error("Erro ao buscar placa:", e);
    }
  }

  // 2. Busca Motoristas
  if (ins.motoristas && ins.motoristas.texto) {
    const motoristas = parseMotoristas(ins.motoristas.texto);
    
    const resultados = motoristas.filter(m => {
      const nomeNorm = normalizarTexto(m.nome);
      const matNorm = normalizarTexto(m.matricula);
      
      if (matNorm === queryNorm) return true;

      const queryWords = queryNorm.split(/\s+/);
      const nomeWords = nomeNorm.split(/\s+/);
      
      return queryWords.every(qw => {
        return nomeWords.some(nw => {
          if (nw === qw || nw.startsWith(qw) || qw.startsWith(nw)) return true;
          if (qw.length > 3 && nw.length > 3) {
            const dist = levenshtein(qw, nw);
            return dist <= Math.floor(qw.length / 3);
          }
          return false;
        });
      });
    });

    if (resultados.length > 0) {
      for (const m of resultados) {
        renderResultadoBusca(container, `Motorista Encontrado`, [
          `<strong>Nome:</strong> ${m.nome}`,
          `<strong>Matrícula:</strong> ${m.matricula}`,
          `<strong>Filial:</strong> ${m.filial}`
        ]);
      }
    } else {
      container.innerHTML = '<div class="vazio">Nenhum motorista ou veículo encontrado.</div>';
    }
  } else {
    container.innerHTML = '<div class="vazio">Base de motoristas não cadastrada. Vá em Insumos.</div>';
  }
}

function renderResultadoBusca(container, titulo, linhas) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginBottom = '12px';
  card.style.padding = '16px 20px';
  
  let html = `<h3 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:16px;">${titulo}</h3>`;
  html += `<div style="font-size:14px; line-height:1.7;">`;
  
  for (const linha of linhas) {
    html += `<div>${linha}</div>`;
  }
  
  html += `</div>`;
  card.innerHTML = html;
  container.appendChild(card);
}
