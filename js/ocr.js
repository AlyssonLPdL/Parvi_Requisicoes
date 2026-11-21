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

function processarImagemOCR(file) {
  if (ocrProcessando) return;
  ocrProcessando = true;

  const statusEl = document.getElementById('ocr-status');
  const resultEl = document.getElementById('ocr-resultado');
  const outputEl = document.getElementById('ocr-output');

  resultEl.classList.add('hidden');
  statusEl.classList.remove('hidden');
  statusEl.className = 'status ocr-loading';
  statusEl.textContent = 'Preparando imagem...';

  // 1. Lê a imagem e inverte as cores (para corrigir o Dark Mode)
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Desenha a imagem original
    ctx.drawImage(img, 0, 0);
    
    // Pega os dados dos pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Inverte as cores (R, G, B) para ficar preto no branco
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];         // R
      data[i + 1] = 255 - data[i + 1]; // G
      data[i + 2] = 255 - data[i + 2]; // B
    }
    
    // Aplica a imagem invertida de volta no canvas
    ctx.putImageData(imageData, 0, 0);
    
    // Converte para Base64 e manda pro Tesseract
    const base64Image = canvas.toDataURL('image/png');
    
    iniciarTesseract(base64Image, statusEl, resultEl, outputEl);
  };
  img.src = URL.createObjectURL(file);
}

function iniciarTesseract(imgBase64, statusEl, resultEl, outputEl) {
  statusEl.textContent = 'Lendo texto da imagem...';

  Tesseract.recognize(
    imgBase64,
    'por',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          statusEl.textContent = `Lendo imagem... ${pct}%`;
        }
      }
    }
  ).then(({ data: { text } }) => {
    statusEl.textContent = 'Formatando...';
    const tsv = formatarParaTSV(text);
    
    if (tsv) {
      outputEl.value = tsv;
      resultEl.classList.remove('hidden');
      statusEl.classList.add('hidden');
    } else {
      statusEl.textContent = 'Não foi possível encontrar chamados válidos. Verifique se a imagem contém textos como "DVR INOPERANTE" e "#104554".';
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
  const linhas = textoBruto.split('\n');
  const chamados = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    
    // 1. Procura por O.S. e Protocolo (#104559 ou 104559)
    const matchOs = linha.match(/#?(\d{5,6})/);
    // 2. Procura por Data (20/11/2026 21:43)
    const matchData = linha.match(/(\d{2}\/\d{2}\/\d{4})/);
    
    // 3. Procura o Assunto. Ex: "DVR INOPERANTE - 33036 - PEB"
    // O Tesseract pode confundir o Ç, então usamos regex flexível
    const matchAssunto = linha.match(/(DVR\s*INOPERANTE|GPS\s*SEM\s*COMUNICA[CÇ][AÃ]O)\s*[-–]\s*(\d+)\s*[-–]\s*([A-Z]{2,3})/i);

    // Se achar a O.S. na mesma linha do assunto (padrão da sua imagem)
    if (matchOs && matchData && matchAssunto) {
      const os = matchOs[1];
      const data = matchData[1];
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

      chamados.push({
        data, veiculo, os, filial, camera, codigo, tipoServico
      });
    } 
    // Caso o Tesseract quebre a linha e o Assunto caia na linha de baixo
    else if (linhas[i+1]) {
      const linhaBaixo = linhas[i+1];
      const matchAssuntoBaixo = linhaBaixo.match(/(DVR\s*INOPERANTE|GPS\s*SEM\s*COMUNICA[CÇ][AÃ]O)\s*[-–]\s*(\d+)\s*[-–]\s*([A-Z]{2,3})/i);
      
      if (matchOs && matchData && matchAssuntoBaixo) {
        const os = matchOs[1];
        const data = matchData[1];
        const tipoBruto = matchAssuntoBaixo[1].toUpperCase();
        const veiculo = matchAssuntoBaixo[2];
        const filial = matchAssuntoBaixo[3];

        let tipoServico = 'DVR INOPERANTE';
        let codigo = '7';
        let camera = 'CAMERA';

        if (tipoBruto.includes('GPS')) {
          tipoServico = 'GPS SEM COMUNICAÇÃO';
          codigo = '8';
          camera = 'TELEMETRIA';
        }

        chamados.push({
          data, veiculo, os, filial, camera, codigo, tipoServico
        });
        i++; // Pula a próxima linha para não duplicar
      }
    }
  }

  // Remove duplicatas (caso o Tesseract leia a mesma coisa duas vezes)
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

  // Gera o TSV final
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
