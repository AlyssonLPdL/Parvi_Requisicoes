'use strict';

const MSG_BASE = 'Boa noite! Poderia me dizer se os veículos abaixo estão rodando ou se estão retidos, por favor? Preciso dessa informação para hoje ainda, se possível. Obrigado!';

function nomeEquipamento(tipo) {
  if (tipo === 'gps') return 'GPS inoperante';
  if (tipo === 'dvr') return 'DVR inoperante';
  return 'Equipamento inoperante';
}

/* ===================== COPYS ===================== */
function agruparPorFilial(resultados) {
  const mapa = {};
  for (const r of resultados) {
    if (!r.aprovado) continue;
    if (r.status !== 'Abrir') continue;
    if (!mapa[r.filial]) mapa[r.filial] = [];
    mapa[r.filial].push(r);
  }
  const saida = [];
  for (const f of ORDEM_FILIAIS) {
    if (mapa[f] && mapa[f].length) {
      saida.push({ filial: f, veiculos: mapa[f] });
    }
  }
  return saida;
}

function textoCopy(grupo, tipo) {
  let t = MSG_BASE + '\n\n';
  t += '🔧 ' + nomeEquipamento(tipo) + '\n\n';
  for (const v of grupo.veiculos) {
    t += 'Veículo ' + v.veiculo + '  —  inoperante há ' + v.tempoFormatado + '\n';
  }
  return t.replace(/\n$/, '');
}

function renderCopys(container, resultados, tipo) {
  const grupos = agruparPorFilial(resultados);
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {
    text: 'Copys por filial — ' + nomeEquipamento(tipo) + ' (status "Abrir")'
  }));

  if (!grupos.length) {
    card.appendChild(el('div', { class: 'vazio',
      text: 'Nenhum veículo com status "Abrir" para gerar copy.' }));
    container.appendChild(card);
    return;
  }

  for (const g of grupos) {
    const bloco = el('div', { class: 'copy-bloco' });
    const header = el('div', { class: 'copy-header' });
    header.appendChild(el('span', {
      class: 'copy-filial',
      text: g.filial + ' (' + g.veiculos.length + ')'
    }));

    const btn = el('button', {
      class: 'btn btn-pequeno',
      text: 'Copiar',
      onclick: () => {
        const txt = textoCopy(g, tipo);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(() => {
            btn.textContent = 'Copiado!';
            setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
          });
        } else {
          const ta = document.createElement('textarea');
          ta.value = txt;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(ta);
          btn.textContent = 'Copiado!';
          setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
        }
      }
    });

    header.appendChild(btn);
    bloco.appendChild(header);

    const pre = el('pre', { class: 'copy-preview' });
    pre.textContent = textoCopy(g, tipo);
    bloco.appendChild(pre);
    card.appendChild(bloco);
  }

  container.appendChild(card);
}

/* ===================== DOWNLOADS ===================== */
function baixarArquivo(nome, conteudo, mime) {
  const blob = new Blob([conteudo], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function gerarTSV(resultados) {
  const linhas = [['Veiculo', 'Filial', 'Tempo', 'Status'].join('\t')];
  for (const r of resultados) {
    if (!r.aprovado) continue;
    linhas.push([
      r.veiculo,
      r.filial || '',
      r.tempoFormatado || '',
      r.status || ''
    ].join('\t'));
  }
  return linhas.join('\n');
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function gerarCSV(resultados) {
  const cols = ['Veiculo', 'VeiculoOriginal', 'Filial', 'TempoOriginal',
                'TempoHoras', 'TempoFormatado', 'Status', 'Resultado', 'Etapa', 'Motivo'];
  const linhas = [cols.map(csvCell).join(',')];

  for (const r of resultados) {
    linhas.push([
      r.veiculo,
      r.veiculoOriginal || '',
      r.filial || '',
      r.tempoTexto || '',
      r.horas != null && !isNaN(r.horas) ? r.horas.toFixed(2) : '',
      r.tempoFormatado || '',
      r.status || '',
      r.aprovado ? 'Aprovado' : 'Removido',
      r.etapa || '',
      r.motivo || ''
    ].map(csvCell).join(','));
  }
  return linhas.join('\n');
}

function renderDownloads(container, resultados, tipo) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { text: 'Downloads' }));

  const wrap = el('div', { class: 'downloads' });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  wrap.appendChild(el('button', {
    class: 'btn',
    text: 'Baixar resultado (TSV)',
    onclick: () => baixarArquivo(
      'resultado_' + tipo + '_' + stamp + '.tsv',
      gerarTSV(resultados),
      'text/tab-separated-values;charset=utf-8'
    )
  }));

  wrap.appendChild(el('button', {
    class: 'btn',
    text: 'Baixar relatório completo (CSV)',
    onclick: () => baixarArquivo(
      'relatorio_' + tipo + '_' + stamp + '.csv',
      gerarCSV(resultados),
      'text/csv;charset=utf-8'
    )
  }));

  card.appendChild(wrap);
  container.appendChild(card);
}
