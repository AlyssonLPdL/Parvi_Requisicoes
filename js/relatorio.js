'use strict';

const ETAPA_LABEL = {
  tempo:    'Tempo',
  vendido:  'Vendido',
  alocacao: 'Alocação',
  filial:   'Filial',
  retidos:  'Retidos',
  os:       'O.S. (Já aberta)',
  ok:       'Aprovado'
};

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.startsWith('data-')) e.setAttribute(k, attrs[k]);
    else if (k.startsWith('on')) e[k] = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  if (children) for (const c of children) if (c) e.appendChild(c);
  return e;
}

function renderResumo(container, resultados) {
  const total = resultados.length;
  const porEtapa = { tempo: 0, vendido: 0, alocacao: 0, filial: 0, retidos: 0, os: 0 };
  
  const aprovados = resultados.filter(r => r.aprovado);

  for (const r of resultados) {
    if (!r.aprovado && porEtapa[r.etapa] != null) porEtapa[r.etapa]++;
  }

  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { text: 'Resumo por etapa' }));

  const ul = el('ul', { class: 'resumo-lista' });
  let restantes = total;

  ul.appendChild(liResumo('Entrada', restantes, null));

  for (const etapa of ['tempo', 'vendido', 'alocacao', 'filial', 'retidos', 'os']) {
    const removidos = porEtapa[etapa] || 0;
    restantes -= removidos;
    ul.appendChild(liResumo(
      'Após ' + ETAPA_LABEL[etapa],
      restantes,
      removidos > 0 ? removidos : null
    ));
  }

  ul.appendChild(liResumo(
    'Aprovados (Abrir O.S.)',
    aprovados.length,
    null,
    aprovados.length + ' veículo(s)'
  ));

  card.appendChild(ul);
  container.appendChild(card);
}

function liResumo(nome, qtd, removidos, extra) {
  const li = el('li');
  li.appendChild(el('span', { text: nome + ': ' }));
  li.appendChild(el('span', { class: 'num', text: String(qtd) }));
  if (removidos != null) {
    li.appendChild(el('span', {
      class: 'removido',
      text: '  (−' + removidos + ' removido(s) nesta etapa)'
    }));
  }
  if (extra) li.appendChild(el('span', { text: '  — ' + extra }));
  return li;
}

function liResumo(nome, qtd, removidos, extra) {
  const li = el('li');
  li.appendChild(el('span', { text: nome + ': ' }));
  li.appendChild(el('span', { class: 'num', text: String(qtd) }));
  if (removidos != null) {
    li.appendChild(el('span', {
      class: 'removido',
      text: '  (−' + removidos + ' removido(s) nesta etapa)'
    }));
  }
  if (extra) li.appendChild(el('span', { text: '  — ' + extra }));
  return li;
}

function renderTabela(container, resultados, idPrefix) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { text: 'Relatório detalhado' }));

  // ---- filtros ----
  const filtros = el('div', { class: 'filtros' });

  const fVeic = el('input', { type: 'text', placeholder: 'Filtrar veículo...' });
  const fRes  = el('select');
  fRes.appendChild(el('option', { value: '', text: 'Todos os resultados' }));
  fRes.appendChild(el('option', { value: 'aprovado', text: 'Só aprovados' }));
  fRes.appendChild(el('option', { value: 'removido', text: 'Só removidos' }));

  const fMotivo = el('select');
  fMotivo.appendChild(el('option', { value: '', text: 'Todos os motivos' }));
  const motivosUnicos = Array.from(new Set(resultados.map(r => r.motivo))).sort();
  for (const m of motivosUnicos) {
    fMotivo.appendChild(el('option', { value: m, text: m }));
  }

  filtros.appendChild(fVeic);
  filtros.appendChild(fRes);
  filtros.appendChild(fMotivo);
  card.appendChild(filtros);

  // ---- tabela ----
  const wrap = el('div', { class: 'tabela-wrap' });
  const tabela = el('table', { class: 'tabela' });

  const thead = el('thead');
  const trHead = el('tr');
  for (const h of ['Veículo', 'Filial', 'Tempo', 'Formatado', 'Status', 'Resultado', 'Motivo']) {
    trHead.appendChild(el('th', { text: h }));
  }
  thead.appendChild(trHead);
  tabela.appendChild(thead);

  const tbody = el('tbody');
  tabela.appendChild(tbody);
  wrap.appendChild(tabela);
  card.appendChild(wrap);

  function aplicarFiltro() {
    const qv = fVeic.value.trim().toLowerCase();
    const qr = fRes.value;
    const qm = fMotivo.value;

    tbody.innerHTML = '';
    let count = 0;

    for (const r of resultados) {
      if (qv && !(r.veiculo + ' ' + (r.veiculoOriginal || '')).toLowerCase().includes(qv)) continue;
      if (qr === 'aprovado' && !r.aprovado) continue;
      if (qr === 'removido' && r.aprovado) continue;
      if (qm && r.motivo !== qm) continue;

      const tr = el('tr', { class: r.aprovado ? '' : 'linha-removida' });
      tr.appendChild(el('td', { text: r.veiculo }));
      tr.appendChild(el('td', { text: r.filial || '—' }));
      tr.appendChild(el('td', { text: r.tempoTexto || '—' }));
      tr.appendChild(el('td', { text: r.tempoFormatado || (r.horas != null ? formatarTempo(r.horas) : '—') }));
      tr.appendChild(el('td', { text: r.status || '—' }));
      tr.appendChild(el('td', { text: r.aprovado ? 'Aprovado' : 'Removido' }));
      tr.appendChild(el('td', { class: 'motivo', text: r.motivo }));
      tbody.appendChild(tr);
      count++;
    }

    if (!count) {
      const tr = el('tr');
      const td = el('td', { colspan: '7', class: 'vazio', text: 'Nenhum veículo corresponde ao filtro.' });
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  fVeic.addEventListener('input', aplicarFiltro);
  fRes.addEventListener('change', aplicarFiltro);
  fMotivo.addEventListener('change', aplicarFiltro);
  aplicarFiltro();

  container.appendChild(card);
}
