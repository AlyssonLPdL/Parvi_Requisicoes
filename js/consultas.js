'use strict';

// Algoritmo de Levenshtein (distância entre palavras)
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

// Limpa o texto para busca (tira acentos, pontuações, etc)
function normalizarTexto(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove tudo que não for letra ou número
    .replace(/\s+/g, ' ')        // Troca múltiplos espaços por um só
    .trim();
}

function realizarBusca() {
  const query = document.getElementById('input-busca').value.trim();
  const container = document.getElementById('resultado-busca');
  container.innerHTML = '';

  if (query.length < 2) return;

  const ins = carregarInsumos();
  const queryNorm = normalizarTexto(query);
  let encontrouAlgo = false;

  // ==========================================
  // 1. BUSCA POR ALOCAÇÃO (PLACA OU Nº ORDEM)
  // ==========================================
  if (ins.alocacao && ins.alocacao.texto) {
    try {
      const alocacaoMap = parseAlocacao(ins.alocacao.texto);
      
      for (const [veiculo, dados] of alocacaoMap.entries()) {
        const placaNorm = normalizarTexto(dados.placa);
        
        if (placaNorm.includes(queryNorm) || veiculo === queryNorm) {
          encontrouAlgo = true;
          renderResultadoBusca(container, `Veículo na Alocação`, [
            `<strong>Nº ORDEM:</strong> ${veiculo}`,
            `<strong>Placa:</strong> ${dados.placa || 'Não informada'}`,
            `<strong>Filial:</strong> ${dados.filial || dados.localizado_original}`,
            `<div style="margin-top:8px; color:var(--text-muted); font-size:12px;">Linha Original:</div>`,
            `<div style="word-break: break-all; font-family:monospace; font-size:12px;">${dados.linha_original}</div>`
          ]);
        }
      }
    } catch(e) { console.error("Erro alocação:", e); }
  }

  // ==========================================
  // 2. BUSCA POR MOTORISTAS (NOME OU MATRÍCULA)
  // ==========================================
  if (ins.motoristas && ins.motoristas.texto) {
    const motoristas = parseMotoristas(ins.motoristas.texto);
    const queryWords = queryNorm.split(' ');

    const resultados = [];

    for (const m of motoristas) {
      const nomeNorm = normalizarTexto(m.nome);
      const matNorm = normalizarTexto(m.matricula);

      // Se digitou a matrícula exata
      if (matNorm === queryNorm) {
        resultados.push({ motorista: m, nota: 100 });
        continue;
      }

      // Se digitou parte do nome, calcula a nota de semelhança
      let nota = 0;
      let acertosPalavras = 0;

      for (const qw of queryWords) {
        let melhorMatch = 0;
        const nomeWords = nomeNorm.split(' ');
        
        for (const nw of nomeWords) {
          if (nw === qw) melhorMatch = Math.max(melhorMatch, 100);
          else if (nw.includes(qw) || qw.includes(nw)) melhorMatch = Math.max(melhorMatch, 80);
          else {
            const dist = levenshtein(qw, nw);
            // Se a distância for pequena em relação ao tamanho da palavra
            if (dist <= Math.floor(qw.length / 2)) {
              melhorMatch = Math.max(melhorMatch, 100 - (dist * 10));
            }
          }
        }
        
        if (melhorMatch > 0) acertosPalavras++;
        nota += melhorMatch;
      }

      // Se acertou pelo menos metade das palavras digitadas, considera válido
      if (acertosPalavras >= Math.ceil(queryWords.length / 2)) {
        resultados.push({ motorista: m, nota: nota / queryWords.length });
      }
    }

    // Ordena pelos mais parecidos
    resultados.sort((a, b) => b.nota - a.nota);

    for (const r of resultados) {
      encontrouAlgo = true;
      renderResultadoBusca(container, `Motorista Encontrado`, [
        `<strong>Nome:</strong> ${r.motorista.nome}`,
        `<strong>Matrícula:</strong> ${r.motorista.matricula}`,
        `<strong>Filial:</strong> ${r.motorista.filial}`,
        `<div style="margin-top:8px; color:var(--text-muted); font-size:12px;">Linha Original:</div>`,
        `<div style="font-family:monospace; font-size:12px; background:#f4f4f4; padding:4px;">${r.motorista.filial}\t${r.motorista.matricula}\t${r.motorista.nome}</div>`
      ]);
    }
  }

  if (!encontrouAlgo) {
    container.innerHTML = '<div class="vazio">Nenhum motorista ou veículo encontrado com esse termo.</div>';
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
