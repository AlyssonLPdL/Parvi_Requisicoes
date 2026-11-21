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

/* ===================== EXTRAÇÃO E FORMATAÇÃO ===================== */
function extrairDados(textoBruto) {
  const linhas = textoBruto.split('\n').map(l => l.trim()).filter(l => l);
  const chamados = [];
  let dataAtual = new Date().toLocaleDateString('pt-BR');

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    
    const matchData = linha.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (matchData) dataAtual = matchData[1];

    const matchAssunto = linha.match(/(DVR\s*INOPERANTE|GPS\s*SEM\s*COMUNICA[CÇ][AÃ]O)\s*[-–—]\s*(\d{5,6})\s*[-–—]\s*([A-Z]{2,3})/i);

    if (matchAssunto) {
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

      let osFinal = null;
      const matchOSForcado = linha.match(/10\d{4}/);
      
      if (matchOSForcado) {
        osFinal = matchOSForcado[0];
      } else {
        const todosNumeros = linha.match(/\d+/g) || [];
        for (const num of todosNumeros) {
          if (num !== veiculo && num.length >= 5 && num.length <= 6) {
              if (num.startsWith('4104')) osFinal = '10' + num.substring(4);
              else if (num.startsWith('410')) osFinal = '10' + num.substring(3);
              else if (num.length === 5 && num.startsWith('0')) osFinal = '1' + num;
              else osFinal = num;
              break;
          }
        }
      }

      chamados.push({
        data: dataAtual, veiculo, os: osFinal || "000000", filial, camera, codigo, tipoServico
      });
    }
  }

  // MÁGICA DO BURACO NA SEQUÊNCIA
  const validos = chamados.filter(c => parseInt(c.os) > 0);
  const invalidos = chamados.filter(c => parseInt(c.os) === 0);

  if (validos.length > 0 && invalidos.length > 0) {
      validos.sort((a, b) => parseInt(a.os) - parseInt(b.os));
      const minOS = parseInt(validos[0].os);
      const maxOS = parseInt(validos[validos.length - 1].os);
      const osExistentes = new Set(validos.map(c => parseInt(c.os)));
      const faltantes = [];
      
      for (let i = minOS; i <= maxOS; i++) {
          if (!osExistentes.has(i)) faltantes.push(i);
      }
      
      if (faltantes.length === invalidos.length) {
          faltantes.sort((a, b) => a - b);
          for (let i = 0; i < invalidos.length; i++) {
              invalidos[i].os = faltantes[i].toString();
          }
      }
  }

  const todos = [...validos, ...invalidos];
  todos.sort((a, b) => parseInt(a.os) - parseInt(b.os));

  const uniqueChamados = [];
  const vistos = new Set();
  for(const c of todos) {
      if(!vistos.has(c.os)) {
          vistos.add(c.os);
          uniqueChamados.push(c);
      }
  }

  return uniqueChamados;
}

function gerarTSV(chamados) {
  return chamados.map(c => 
    `${c.data}\t${c.veiculo}\t${c.os}\t${c.filial}\t${c.camera}\t${c.codigo}\t${c.tipoServico}`
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
