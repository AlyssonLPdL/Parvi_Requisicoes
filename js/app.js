'use strict';

function ativarAba(nome) {
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('ativo', b.dataset.tab === nome);
  });
  document.querySelectorAll('.painel').forEach(p => {
    p.hidden = (p.id !== 'painel-' + nome);
  });
  if (nome === 'insumos') renderInsumos();
  if (nome === 'consultas') {
    const input = document.getElementById('input-busca');
    if(input) { input.value = ''; setTimeout(() => input.focus(), 100); }
    const res = document.getElementById('resultado-busca');
    if(res) res.innerHTML = '';
  }
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => ativarAba(btn.dataset.tab));
});

/* ===================== INSUMOS ===================== */
function renderInsumos() {
  const ins = carregarInsumos();
  document.getElementById('txt-alocacao').value = ins.alocacao.texto;
  document.getElementById('txt-retidos').value  = ins.retidos.texto;
  const elMot = document.getElementById('txt-motoristas');
  if (elMot) elMot.value = ins.motoristas.texto;

  const alarme = document.getElementById('alarme-insumos');
  const partes = [];
  const a1 = textoAlarmeInsumo('Alocação', ins.alocacao);
  const a2 = textoAlarmeInsumo('Retidos',  ins.retidos);
  const a3 = textoAlarmeInsumo('Motoristas', ins.motoristas);
  if (a1) partes.push(a1);
  if (a2) partes.push(a2);
  if (a3) partes.push(a3);

  if (partes.length) {
    alarme.hidden = false;
    alarme.textContent = partes.join(' • ');
    alarme.classList.toggle('vencido', ins.alocacao.vencido || ins.retidos.vencido || ins.motoristas.vencido);
  } else {
    alarme.hidden = true;
  }
}

const btnSalvarInsumos = document.getElementById('btn-salvar-insumos');
if (btnSalvarInsumos) {
  btnSalvarInsumos.addEventListener('click', () => {
    const aloc = document.getElementById('txt-alocacao').value;
    const ret  = document.getElementById('txt-retidos').value;
    const mot  = document.getElementById('txt-motoristas') ? document.getElementById('txt-motoristas').value : '';
    salvarInsumos(aloc, ret, mot);
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
  if (ins.alocacao.vencido && !confirm('Alocação vencida. Processar mesmo assim?')) return;
  if (ins.retidos.vencido && !confirm('Retidos vencidos. Processar mesmo assim?')) return;

  const alocacao = parseAlocacao(ins.alocacao.texto);
  const retidos  = parseRetidos(ins.retidos.texto);

  // DEBUG: Mostra no console se a alocação leu os veículos certos
  console.log("Alocação carregada com " + (alocacao.size || 0) + " itens.");
  console.log("Primeiros 5 veículos na alocação:", Array.from(alocacao.keys()).slice(0, 5));

  if (!alocacao || alocacao.size === 0) {
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
  renderCopys(box, resultados, tipo); 
  renderTabela(box, resultados, tipo);
  renderDownloads(box, resultados, tipo);
}

const btnGps = document.getElementById('btn-processar-gps');
if (btnGps) btnGps.addEventListener('click', () => processar('gps'));

const btnDvr = document.getElementById('btn-processar-dvr');
if (btnDvr) btnDvr.addEventListener('click', () => processar('dvr'));

/* ===================== INICIALIZAÇÃO ===================== */
document.addEventListener('DOMContentLoaded', () => {
  ativarAba('gps');
});
