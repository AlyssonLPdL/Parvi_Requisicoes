'use strict';

let ocrProcessando = false;

// Ao carregar a página, atualiza a mensagem com o que já está salvo
document.addEventListener('DOMContentLoaded', () => {
  atualizarMensagemAcumulada();
  
  const dropzone = document.getElementById('ocr-dropzone');
  const fileInput = document.getElementById('ocr-file-input');

  if (!dropzone) return;

  dropzone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) processarImagemOCR(e.target.files[0]);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) processarImagemOCR(e.dataTransfer.files[0]);
  });

  document.addEventListener('paste', (e) => {
    const painelOcr = document.getElementById('painel-ocr');
    if (painelOcr && !painelOcr.hidden) {
      if (e.clipboardData.getData('text')) {
        const texto = e.clipboardData.getData('text');
        if (texto.trim().length > 10) {
            processarTextoPuro(texto);
            return;
        }
      }
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          processarImagemOCR(items[i].getAsFile());
          break;
        }
      }
    }
  });
});

/* ===================== HISTÓRICO ===================== */
function getHistorico() {
  try {
    return JSON.parse(localStorage.getItem('historico_chamados_ocr') || '[]');
  } catch (e) {
    return [];
  }
}

function salvarHistorico(lista) {
  localStorage.setItem('historico_chamados_ocr', JSON.stringify(lista));
}

function adicionarAoHistorico(novosChamados) {
  const historico = getHistorico();
  let adicionou = false;

  for (const novo of novosChamados) {
    // Se a O.S. já existe no histórico, ignora
    if (!historico.find(c => c.os === novo.os)) {
      historico.push(novo);
      adicionou = true;
    }
  }

  if (adicionou) {
    // Ordena pelo número da O.S. para manter a sequência bonita
    historico.sort((a, b) => parseInt(a.os) - parseInt(b.os));
    salvarHistorico(historico);
    atualizarMensagemAcumulada();
  }
}

function limparHistoricoOCR() {
  if (confirm('Tem certeza que deseja limpar todo o histórico de chamados lidos?')) {
    localStorage.removeItem('historico_chamados_ocr');
    atualizarMensagemAcumulada();
    document.getElementById('ocr-resultado').classList.add('hidden');
  }
}

function atualizarMensagemAcumulada() {
  const historico = getHistorico();
  const txtMsg = document.getElementById('ocr-mensagem');
  if (!txtMsg) return;

  if (historico.length === 0) {
    txtMsg.value = '';
    return;
  }

  const dataAtual = new Date().toLocaleDateString('pt-BR');
  
  let mensagem = `Chamados abertos ${dataAtual}:\n\n`;
  
  for (const c of historico) {
    // Ajusta o nome do equipamento para ficar igual ao seu exemplo
    let equipamento = c.camera; // CAMERA ou TELEMETRIA
    
    // Formato: Data \t Veiculo \t OS \t Filial \t Equipamento
    mensagem += `${c.data}\t${c.veiculo}\t${c.os}\t${c.filial}\t${equipamento}\n`;
  }
  
  mensagem += `\nAtt: Alysson leite, ${dataAtual}, 18:00 às 06:00`;

  txtMsg.value = mensagem;
}

/* ===================== OCR E PROCESSAMENTO ===================== */
function processarTextoPuro(texto) {
  const statusEl = document.getElementById('ocr-status');
  const resultEl = document.getElementById('ocr-resultado');
  const outputEl = document.getElementById('ocr-output');

  statusEl.classList.remove('hidden');
  statusEl.className = 'status ocr-loading';
  statusEl.textContent = 'Formatando texto...';

  const chamados = extrairDados(texto);
  
  if (chamados.length > 0) {
    outputEl.value = gerarTSV(chamados);
    adicionarAoHistorico(chamados);
    resultEl.classList.remove('hidden');
    statusEl.classList.add('hidden');
  } else {
    statusEl.textContent = 'Texto colado não contém chamados válidos no formato esperado.';
    statusEl.style.color = 'var(--danger)';
  }
}

function processarImagemOCR(file) {
  if (ocrProcessando) return;
  ocrProcessando = true;

  const statusEl = document.getElementById('ocr-status');
  const resultEl = document.getElementById('ocr-resultado');
  const outputEl = document.getElementById('ocr-output');

  resultEl.classList.add('hidden');
  statusEl.classList.remove('hidden');
  statusEl.className = 'status ocr-loading';
  statusEl.textContent = 'Preparando imagem (Alto Contraste)...';

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const luminosidade = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const cor = luminosidade > 128 ? 255 : 0; 
      data[i] = cor; data[i + 1] = cor; data[i + 2] = cor;
    }
    
    ctx.putImageData(imageData, 0, 0);
    const base64Image = canvas.toDataURL('image/png');
    
    iniciarTesseract(base64Image, statusEl, resultEl, outputEl);
  };
  img.src = URL.createObjectURL(file);
}

function iniciarTesseract(imgBase64, statusEl, resultEl, outputEl) {
  statusEl.textContent = 'Lendo imagem...';

  Tesseract.recognize(imgBase64, 'por', {
      logger: m => {
        if (m.status === 'recognizing text') {
          statusEl.textContent = `Lendo imagem... ${Math.round(m.progress * 100)}%`;
        }
      }
  }).then(({ data: { text } }) => {
    console.log('TEXTO BRUTO RECONHECIDO PELO OCR:', text);
    statusEl.textContent = 'Formatando dados...';
    const chamados = extrairDados(text);
    
    if (chamados.length > 0) {
      outputEl.value = gerarTSV(chamados);
      adicionarAoHistorico(chamados);
      resultEl.classList.remove('hidden');
      statusEl.classList.add('hidden');
    } else {
      statusEl.innerHTML = 'Não foi possível ler a imagem. Tente novamente com uma imagem mais nítida.';
      statusEl.style.color = 'var(--danger)';
    }
  }).catch(err => {
    console.error(err);
    statusEl.textContent = 'Erro ao ler a imagem. Tente novamente.';
    statusEl.style.color = 'var(--danger)';
  }).finally(() => {
    ocrProcessando = false;
  });
}

/* ===================== LOCALIZAÇÃO DA O.S. ===================== */

function normalizarNumeroOS(valor) {
  let numero = String(valor || '')
    .toUpperCase()
    .replace(/[OQ]/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/\D/g, '');

  if (
    numero.length < 5 ||
    numero.length > 7 ||
    /^0+$/.test(numero)
  ) {
    return null;
  }

  // Mantém as conversões utilizadas no código original
  if (numero.startsWith('4104')) {
    numero = '10' + numero.substring(4);
  } else if (numero.startsWith('410')) {
    numero = '10' + numero.substring(3);
  } else if (numero.length === 5 && numero.startsWith('0')) {
    numero = '1' + numero;
  }

  return numero;
}


function localizarNumeroOS(linhas, indice, veiculo) {

  // Procura na linha atual, nas duas anteriores e nas duas seguintes
  const indices = [];

  for (let distancia = 0; distancia <= 2; distancia++) {

    if (indice - distancia >= 0) {
      indices.push(indice - distancia);
    }

    if (distancia > 0 && indice + distancia < linhas.length) {
      indices.push(indice + distancia);
    }
  }

  const textoJanela = indices
    .map(i => linhas[i])
    .join(' ');

  // Primeiro tenta encontrar o número após um identificador conhecido
  const regexRotulo =
    /(?:PROTOCOLO|ORDEM\s+DE\s+SERVI[ÇC]O|O\s*\.?\s*S\.?)\D{0,20}([0-9OQIL|]{2,3}[ .]?[0-9OQIL|]{2,4}|[0-9OQIL|]{5,7})/gi;

  let resultado;

  while ((resultado = regexRotulo.exec(textoJanela)) !== null) {

    const numero = normalizarNumeroOS(resultado[1]);

    if (numero && numero !== String(veiculo)) {
      return numero;
    }
  }

  // Se não encontrar pelo rótulo, procura números nas linhas próximas
  const regexNumeros =
    /[0-9OQIL|]{5,7}|[0-9OQIL|]{2,3}[ .][0-9OQIL|]{2,4}/g;

  for (const indiceLinha of indices) {

    const linha = linhas[indiceLinha];

    // Evita pegar o número de outro chamado próximo
    if (
      indiceLinha !== indice &&
      /(DVR\s*INOPERANTE|GPS\s*SEM\s*COMUNICA[CÇ][AÃ]O)/i.test(linha)
    ) {
      continue;
    }

    const encontrados = linha.match(regexNumeros) || [];

    const numeros = encontrados
      .map(normalizarNumeroOS)
      .filter(numero => numero && numero !== String(veiculo));

    // Dá preferência aos protocolos iniciados por 10
    const numeroOS =
      numeros.find(numero => numero.startsWith('10')) ||
      numeros[0];

    if (numeroOS) {
      return numeroOS;
    }
  }

  return null;
}

/* ===================== EXTRAÇÃO E FORMATAÇÃO ===================== */
function extrairDados(textoBruto) {

  const linhas = String(textoBruto || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l);

  const chamados = [];

  let dataAtual = new Date().toLocaleDateString('pt-BR');

  for (let i = 0; i < linhas.length; i++) {

    const linha = linhas[i];

    const matchData = linha.match(/(\d{2}\/\d{2}\/\d{4})/);

    if (matchData) {
      dataAtual = matchData[1];
    }

    const matchAssunto = linha.match(
      /(DVR\s*INOPERANTE|GPS\s*SEM\s*COMUNICA[CÇ][AÃ]O)\s*[-–—]\s*(\d{5,6})\s*[-–—]\s*([A-Z]{2,3})/i
    );

    if (!matchAssunto) {
      continue;
    }

    const tipoBruto = matchAssunto[1].toUpperCase();
    const veiculo = matchAssunto[2];
    const filial = matchAssunto[3];

    let tipoServico = 'DVR INOPERANTE';
    let codigo = '7';
    let camera = 'CAMERA';

    if (tipoBruto.includes('GPS')) {
      tipoServico = 'GPS SEM COMUNICAÇÃO';
      codigo = '8';
      camera = 'TELEMETRIA';
    }

    // Procura o protocolo também nas linhas próximas
    const osFinal = localizarNumeroOS(linhas, i, veiculo);

    chamados.push({
      data: dataAtual,
      veiculo,
      os: osFinal,
      filial,
      camera,
      codigo,
      tipoServico
    });
  }

  /* ===================== AJUSTE DE SEQUÊNCIA ===================== */

  const validos = chamados.filter(c =>
    c.os && /^\d+$/.test(String(c.os)) && Number(c.os) > 0
  );

  const invalidos = chamados.filter(c => !c.os);

  if (validos.length > 0 && invalidos.length > 0) {

    validos.sort((a, b) => Number(a.os) - Number(b.os));

    const minOS = Number(validos[0].os);
    const maxOS = Number(validos[validos.length - 1].os);

    const osExistentes = new Set(
      validos.map(c => Number(c.os))
    );

    const faltantes = [];

    for (let numero = minOS; numero <= maxOS; numero++) {

      if (!osExistentes.has(numero)) {
        faltantes.push(numero);
      }
    }

    // Só preenche quando a quantidade de lacunas for exatamente igual
    // à quantidade de chamados sem O.S. identificada
    if (faltantes.length === invalidos.length) {

      faltantes.sort((a, b) => a - b);

      for (let i = 0; i < invalidos.length; i++) {
        invalidos[i].os = String(faltantes[i]);
      }
    }
  }

  /* ===================== ORDENAÇÃO ===================== */

  const todos = [...validos, ...invalidos];

  todos.sort((a, b) => {

    const numeroA = a.os ? Number(a.os) : Infinity;
    const numeroB = b.os ? Number(b.os) : Infinity;

    return numeroA - numeroB;
  });

  /* ===================== ELIMINAR DUPLICADOS ===================== */

  const uniqueChamados = [];
  const vistos = new Set();

  for (const chamado of todos) {

    // Não elimina chamados diferentes só porque não foi possível
    // identificar o protocolo deles.
    if (!chamado.os) {
      uniqueChamados.push(chamado);
      continue;
    }

    if (!vistos.has(chamado.os)) {
      vistos.add(chamado.os);
      uniqueChamados.push(chamado);
    }
  }

  return uniqueChamados;
}

function gerarTSV(chamados) {
  return chamados.map(c =>
    `${c.data}\t${c.veiculo}\t${c.os || 'NÃO IDENTIFICADA'}\t${c.filial}\t${c.camera}\t${c.codigo}\t${c.tipoServico}`
  ).join('\n');
}

/* ===================== UTILITÁRIOS ===================== */
// Função genérica para copiar qualquer textarea
function copiarTexto(idTextarea, event) {
  const textarea = document.getElementById(idTextarea);
  if(!textarea) return;
  textarea.select();
  document.execCommand('copy');
  window.getSelection().removeAllRanges();
  
  const btn = event.target;
  const textoOriginal = btn.textContent;
  btn.textContent = 'Copiado!';
  setTimeout(() => btn.textContent = textoOriginal, 2000);
}
