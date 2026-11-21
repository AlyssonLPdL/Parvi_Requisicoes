'use strict';

let ocrProcessando = false;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('ocr-dropzone');
  const fileInput = document.getElementById('ocr-file-input');

  if (!dropzone) return;

  // Clique para selecionar arquivo
  dropzone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      processarImagemOCR(e.target.files[0]);
    }
  });

  // Arrastar e soltar
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      processarImagemOCR(e.dataTransfer.files[0]);
    }
  });

  // Ctrl+V
  document.addEventListener('paste', (e) => {
    // Só processa se a aba OCR estiver visível
    const painelOcr = document.getElementById('painel-ocr');
    if (painelOcr && !painelOcr.hidden) {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          processarImagemOCR(blob);
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
  statusEl.textContent = 'Iniciando leitura...';

  // Inicia Tesseract
  Tesseract.recognize(
    file,
    'por', // Português
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          statusEl.textContent = `Lendo imagem... ${pct}%`;
        } else {
          statusEl.textContent = `Preparando OCR (${m.status})...`;
        }
      }
    }
  ).then(({ data: { text } }) => {
    statusEl.textContent = 'Processando texto extraído...';
    const tsv = formatarParaTSV(text);
    
    if (tsv) {
      outputEl.value = tsv;
      resultEl.classList.remove('hidden');
      statusEl.classList.add('hidden');
    } else {
      statusEl.textContent = 'Nenhum chamado válido encontrado na imagem. Tente novamente com uma imagem mais nítida.';
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

  for (const linha of linhas) {
    // Regex para pegar O.S. (#104554)
    const matchOs = linha.match(/#(\d+)/);
    // Regex para pegar Data (20/11/2026)
    const matchData = linha.match(/(\d{2}\/\d{2}\/\d{4})/);
    // Regex para pegar Assunto (GPS SEM COMUNICAÇÃO - 55044 - MA)
    // O Tesseract pode ler "COMUNICAÇÂO", então usamos regex flexível
    const matchAssunto = linha.match(/(GPS\s*SEM\s*COMUNICA[CÇ][AÃ]O|DVR\s*INOPERANTE|AJUSTE\s*CAMERA\s*FADIGA|CAMERA\s*INOPERANTE)\s*-\s*(\d+)\s*-\s*([A-Z]+)/i);

    if (matchOs && matchData && matchAssunto) {
      const os = matchOs[1];
      const data = matchData[1];
      const tipoBruto = matchAssunto[1].toUpperCase();
      const veiculo = matchAssunto[2];
      const filial = matchAssunto[3];

      // Define o tipo, código e câmera baseado no serviço
      let tipoServico = 'DVR INOPERANTE';
      let codigo = '7';
      let camera = 'CAMERA';

      if (tipoBruto.includes('GPS')) {
        tipoServico = 'GPS SEM COMUNICAÇÃO';
        codigo = '8';
        camera = 'TELEMETRIA';
      } else if (tipoBruto.includes('FADIGA')) {
        tipoServico = 'AJUSTE CAMERA FADIGA';
        codigo = '1';
      } else if (tipoBruto.includes('CAMERA INOPERANTE')) {
        tipoServico = 'CAMERA INOPERANTE';
        codigo = '6';
      }

      chamados.push({
        data,
        veiculo,
        os,
        filial,
        camera,
        codigo,
        tipoServico
      });
    }
  }

  // Ordena pelo número da O.S. (crescente)
  chamados.sort((a, b) => parseInt(a.os) - parseInt(b.os));

  // Gera o TSV
  const linhasTSV = chamados.map(c => 
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
