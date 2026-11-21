'use strict';

let ocrProcessando = false;

document.addEventListener('DOMContentLoaded', () => {
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
      // Se colar texto puro (copiado da tela)
      if (e.clipboardData.getData('text')) {
        const texto = e.clipboardData.getData('text');
        if (texto.trim().length > 10) {
            processarTextoPuro(texto);
            return;
        }
      }
      // Se colar imagem
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

function processarTextoPuro(texto) {
  const statusEl = document.getElementById('ocr-status');
  const resultEl = document.getElementById('ocr-resultado');
  const outputEl = document.getElementById('ocr-output');

  statusEl.classList.remove('hidden');
  statusEl.className = 'status ocr-loading';
  statusEl.textContent = 'Formatando texto...';

  const tsv = formatarParaTSV(texto);
  if (tsv) {
    outputEl.value = tsv;
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
    
    // Filtro agressivo: Transforma em Preto e Branco puro (Binarização)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Calcula a luminosidade do pixel
      const luminosidade = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      
      // Se for escuro, vira preto (0). Se for claro, vira branco (255).
      // Isso ignora tons de cinza e melhora o OCR em interfaces dark.
      const cor = luminosidade > 128 ? 255 : 0; 
      
      data[i] = cor;         // R
      data[i + 1] = cor;     // G
      data[i + 2] = cor;     // B
    }
    
    ctx.putImageData(imageData, 0, 0);
    const base64Image = canvas.toDataURL('image/png');
    
    iniciarTesseract(base64Image, statusEl, resultEl, outputEl);
  };
  img.src = URL.createObjectURL(file);
}

function iniciarTesseract(imgBase64, statusEl, resultEl, outputEl) {
  statusEl.textContent = 'Lendo imagem...';

  Tesseract.recognize(
    imgBase64,
    'por',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          statusEl.textContent = `Lendo imagem... ${Math.round(m.progress * 100)}%`;
        }
      }
    }
  ).then(({ data: { text } }) => {
    statusEl.textContent = 'Formatando dados...';
    const tsv = formatarParaTSV(text);
    
    if (tsv) {
      outputEl.value = tsv;
      resultEl.classList.remove('hidden');
      statusEl.classList.add('hidden');
    } else {
      statusEl.innerHTML = 'Não foi possível ler a imagem. <br><br><b>Dica:</b> Use a Ferramenta de Captura do Windows (Win + Shift + S), recorte a área e tente novamente. Ou selecione o texto na tela e dê Ctrl+C para colar como texto.';
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

function formatarParaTSV(textoBruto) {
  // Limpa o texto e separa por linhas
  const linhas = textoBruto.split('\n').map(l => l.trim()).filter(l => l);
  const chamados = [];

  let osAtual = null;
  let dataAtual = null;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    
    // 1. Procura a Data (20/11/2026)
    const matchData = linha.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (matchData) dataAtual = matchData[1];

    // 2. Procura a O.S. (o Tesseract pode ler o # como 4 ou não ler, então buscamos um número de 5 a 6 dígitos)
    // Geralmente a O.S. fica no começo da linha
    const matchOS = linha.match(/(?:#|4)?(\d{5,6})/);
    if (matchOS && matchOS[1].startsWith('10')) { // As O.S. do seu sistema começam com 10 (ex: 104559)
        osAtual = matchOS[1];
    }

    // 3. Procura o Assunto e o Veículo: "TEXTO - 33036 - PEB"
    // A regex busca a palavra, um hífen, o número e outro hífen e a sigla.
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

      // Se por acaso a O.S. ou a Data não estavam na mesma linha, tenta pegar da linha anterior
      const osFinal = osAtual || "000000"; 
      const dataFinal = dataAtual || "00/00/0000";

      chamados.push({
        data: dataFinal, veiculo, os: osFinal, filial, camera, codigo, tipoServico
      });
      
      // Limpa os temporários para não repetir na próxima linha
      osAtual = null;
      dataAtual = null;
    }
  }

  // Remove duplicatas
  const uniqueChamados = [];
  const vistos = new Set();
  for(const c of chamados) {
      if(!vistos.has(c.os)) {
          vistos.add(c.os);
          uniqueChamados.push(c);
      }
  }

  // Ordena pelo número da O.S.
  uniqueChamados.sort((a, b) => parseInt(a.os) - parseInt(b.os));

  // Gera o TSV
  const linhasTSV = uniqueChamados.map(c => 
    `${c.data}\t${c.veiculo}\t${c.os}\t${c.filial}\t${c.camera}\t${c.codigo}\t${c.tipoServico}`
  );

  return linhasTSV.join('\n');
}

function copiarOCR() {
  const textarea = document.getElementById('ocr-output');
  textarea.select();
  document.execCommand('copy');
  window.getSelection().removeAllRanges();
  
  const btn = event.target;
  const textoOriginal = btn.textContent;
  btn.textContent = 'Copiado!';
  setTimeout(() => btn.textContent = textoOriginal, 2000);
}
