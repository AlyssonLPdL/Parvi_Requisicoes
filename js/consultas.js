'use strict';

// Algoritmo para calcular a distância entre duas palavras (tolerância a erros de digitação)
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
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // remoção
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
  
  // 1. Tenta buscar por PLACA (se tiver letras e números juntos, ou se for só números, mas tamanho de placa)
  const isPlaca = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(query) || /^[A-Z]{3}[0-9]{4}$/i.test(query);
  
  if (isPlaca && ins.alocacao.texto) {
    try {
      const alocacaoMap = parseAlocacao(ins.alocacao.texto);
      let achou = false;
      
      for (const [veiculo, dados] of alocacaoMap.entries()) {
        if (dados.placa.toUpperCase().includes(query.toUpperCase())) {
          achou = true;
          renderResultadoBusca(container, `Placa Encontrada: ${dados.placa}`, [
            `Nº ORDEM: ${veiculo}`,
            `Filial: ${dados.filial || dados.localizado_original}`,
            `Linha Original:`,
            dados.linha_original
          ]);
        }
      }
      if (!achou) container.innerHTML = '<div class="vazio">Nenhuma placa encontrada na alocação.</div>';
      return; // Se era placa, para aqui.
    } catch(e) {}
  }

  // 2. Se não for placa, busca Motoristas (Nome ou Matrícula)
  if (ins.motoristas.texto) {
    const motoristas = parseMotoristas(ins.motoristas.texto);
    
    // Filtra os motoristas usando a lógica de proximidade (Fuzzy)
    const resultados = motoristas.filter(m => {
      const nomeNorm = normalizarTexto(m.nome);
      const matNorm = normalizarTexto(m.matricula);
      
      // Se for busca por matrícula exata
      if (matNorm === queryNorm) return true;

      // Busca por nome (tolerância a erros)
      const queryWords = queryNorm.split(/\s+/);
      const nomeWords = nomeNorm.split(/\s+/);
      
      return queryWords.every(qw => {
        return nomeWords.some(nw => {
          if (nw === qw || nw.startsWith(qw) || qw.startsWith(nw)) return true;
          // Se a palavra tiver mais de 3 letras, permite errar até 30% das letras
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
        renderResultadoBusca(container, `Motorista Encontrado: ${m.nome}`, [
          `Matrícula: ${m.matricula}`,
          `Filial: ${m.filial}`,
          `Linha Original:`,
          `${m.filial}\t${m.matricula}\t${m.nome}`
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
  
  let html = `<h3 style="margin-top:0; color:var(--primary);">${titulo}</h3>`;
  html += `<div style="font-size:14px; line-height:1.6; background:var(--surface-alt); padding:12px; border-radius:6px; border:1px solid var(--border); font-family:monospace;">`;
  
  for (const linha of linhas) {
    html += `<div>${linha}</div>`;
  }
  
  html += `</div>`;
  card.innerHTML = html;
  container.appendChild(card);
}
