'use strict';

/* ===================== ABAS ===================== */
function ativarAba(nome) {
  // Atualiza a classe de todos os botões da sidebar
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('ativo', b.dataset.tab === nome);
  });

  // Mostra o painel correto e esconde os outros
  document.querySelectorAll('.painel').forEach(p => {
    p.hidden = (p.id !== 'painel-' + nome);
  });

  // Se for insumos, atualiza a tela com os dados salvos
  if (nome === 'insumos') renderInsumos();
}

// Adiciona o evento de clique em todos os botões com a classe .tab
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => ativarAba(btn.dataset.tab));
});

/* ===================== INSUMOS ===================== */
function renderInsumos() {
  const ins = carregarInsumos();
  document.getElementById('txt-alocacao').value = ins.alocacao.texto;
  document.getElementById('txt-retidos').value  = ins.retidos.texto;

  const alarme = document.getElementById('alarme-insumos');
  const partes = [];
  const a1 = textoAlarmeInsumo('Alocação', ins.alocacao);
  const a2 = textoAlarmeInsumo('Retidos',  ins.retidos);
  if (a1) partes.push(a1);
  if (a2) partes.push(a2);

  if (partes.length) {
    alarme.hidden = false;
    alarme.textContent = partes.join(' • ');
    alarme.classList.toggle('vencido',
      ins.alocacao.vencido || ins.retidos.vencido);
  } else {
    alarme.hidden = true;
  }
}

const btnSalvarInsumos = document.getElementById('btn-salvar-insumos');
if (btnSalvarInsumos) {
  btnSalvarInsumos.addEventListener('click', () => {
    const aloc = document.getElementById('txt-alocacao').value;
    const ret  = document.getElementById('txt-retidos').value;
    salvarInsumos(aloc, ret);
    const st = document.getElementById('status-insumos');
    st.textContent = 'Salvos em ' + new Date().toLocaleString('pt-BR');
    setTimeout(() => { st.textContent = ''; }, 4000);
    renderInsumos();
  });
}

/* ===================== PROCESSAMENTO ===================== */
function limparResultado(tipo) {
  const box = document.getElementById('result-' + tipo);
  if (!box) return null;
  box.innerHTML = '';
  return box;
}

function processar(tipo) {
  const ins = carregarInsumos();

  if (ins.alocacao.vencido && !confirm(
      'Insumos de ALOCAÇÃO vencidos (mais de 7 dias). Processar mesmo assim?')) return;
  if (ins.retidos.vencido && !confirm(
      'Insumos de RETIDOS vencidos. Processar mesmo assim?')) return;

  const alocacao = parseAlocacao(ins.alocacao.texto);
  const retidos  = parseRetidos(ins.retidos.texto);

  if (!alocacao.length) {
    alert('Nenhum registro de alocação encontrado. Salve a alocação na aba Insumos.');
    return;
  }

  const veicTexto = document.getElementById('veic-' + tipo).value;
  const chamTexto = document.getElementById('cham-' + tipo).value;

  const veiculos = tipo === 'gps' ? parseGPS(veicTexto) : parseDVR(veicTexto);
  if (!veiculos.length) {
    alert('Nenhum veículo detectado na colagem.');
    return;
  }

  const chamados = parseChamados(chamTexto);
  const ctx = { alocacao, retidos, chamados };
  const proc = tipo === 'gps' ? processarGPS : processarDVR;

  const resultados = veiculos.map(v => proc(v, ctx));

  const box = limparResultado(tipo);
  if (!box) return;
  
  renderResumo(box, resultados);
  renderCopys(box, resultados, tipo); // <-- Aqui está o tipo sendo passado corretamente
  renderTabela(box, resultados, tipo);
  renderDownloads(box, resultados, tipo);
}

const btnGps = document.getElementById('btn-processar-gps');
if (btnGps) btnGps.addEventListener('click', () => processar('gps'));

const btnDvr = document.getElementById('btn-processar-dvr');
if (btnDvr) btnDvr.addEventListener('click', () => processar('dvr'));

/* ===================== INICIALIZAÇÃO ===================== */
document.addEventListener('DOMContentLoaded', () => {
  // Inicia na aba GPS por padrão
  ativarAba('gps');
});
