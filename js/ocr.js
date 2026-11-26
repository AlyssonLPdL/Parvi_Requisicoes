'use strict';

let ocrProcessando = false;

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

function ordenarChamadosPorOS(chamados) {
  return [...chamados].sort((a, b) => {
    const textoA = String(a.os || '').trim();
    const textoB = String(b.os || '').trim();
    const numeroA = /^\d{6}$/.test(textoA) ? Number(textoA) : Infinity;
    const numeroB = /^\d{6}$/.test(textoB) ? Number(textoB) : Infinity;

    if (numeroA !== numeroB) return numeroA - numeroB;
    return String(a.veiculo || '').localeCompare(String(b.veiculo || ''), 'pt-BR', { numeric: true });
  });
}

function removerDuplicadosPorIdentidade(chamados) {
  const vistos = new Set();

  return chamados.filter(c => {
    const chave = [
      String(c.data || ''),
      String(c.veiculo || ''),
      String(c.filial || ''),
      String(c.camera || ''),
      String(c.tipoServico || ''),
      String(c.os || '')
    ].join('|');

    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

function adicionarAoHistorico(novosChamados) {
  const historico = getHistorico();
  let adicionou = false;

  for (const novo of novosChamados) {

    const chaveNovo = [novo.data, novo.veiculo, novo.filial, novo.camera, novo.tipoServico, novo.os || ''].join('|');
    const jaExiste = historico.some(c =>
      [c.data, c.veiculo, c.filial, c.camera, c.tipoServico, c.os || ''].join('|') === chaveNovo
    );

    if (!jaExiste) {
      historico.push(novo);
      adicionou = true;
    }
  }

  if (adicionou) {
    salvarHistorico(ordenarChamadosPorOS(historico));
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
  const historico = ordenarChamadosPorOS(getHistorico());
  const txtMsg = document.getElementById('ocr-mensagem');
  if (!txtMsg) return;

  if (historico.length === 0) {
    txtMsg.value = '';
    return;
  }

  const dataAtual = new Date().toLocaleDateString('pt-BR');

  let mensagem = `Chamados abertos ${dataAtual}:\n\n`;

  for (const c of historico) {
    mensagem += `${c.data}\t${c.veiculo}\t${c.os}\t${c.filial}\t${c.tipoServico}\n`;
  }

  mensagem += `\nAtt: Alysson leite, ${dataAtual}, 18:00 às 06:00`;

  txtMsg.value = mensagem;
}

/* ===================== OCR REFORÇADO DO PROTOCOLO ===================== */

async function reconhecerProtocoloNoRecorte(img, dadosOCR, chamado) {

  const palavras = dadosOCR.words || [];
  const veiculo = String(chamado.veiculo);

  const palavraVeiculo = palavras.find(p =>
    String(p.text).replace(/\D/g, '') === veiculo
  );

  if (!palavraVeiculo) {
    console.warn('Veículo não localizado:', veiculo);
    return null;
  }

  const box = palavraVeiculo.bbox;

  const alturaTexto = Math.max(
    box.y1 - box.y0,
    img.height * 0.008
  );

  const margemSuperior = alturaTexto * 5;
  const margemInferior = alturaTexto * 5;

  const yInicial = Math.max(
    0,
    Math.floor(box.y0 - margemSuperior)
  );

  const yFinal = Math.min(
    img.height,
    Math.ceil(box.y1 + margemInferior)
  );

  const altura = yFinal - yInicial;

  const escala = 4;

  const canvas = document.createElement('canvas');

  canvas.width = img.width * escala;
  canvas.height = altura * escala;

  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    img,
    0,
    yInicial,
    img.width,
    altura,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imagemCinza = ctx.getImageData(
    0, 0, canvas.width, canvas.height
  );

  const imagemContraste = ctx.createImageData(
    canvas.width,
    canvas.height
  );

  for (let i = 0; i < imagemCinza.data.length; i += 4) {

    const r = imagemCinza.data[i];
    const g = imagemCinza.data[i + 1];
    const b = imagemCinza.data[i + 2];

    const cinza = (
      r * 0.299 +
      g * 0.587 +
      b * 0.114
    );

    imagemCinza.data[i] = cinza;
    imagemCinza.data[i + 1] = cinza;
    imagemCinza.data[i + 2] = cinza;

    const contraste = cinza > 155 ? 255 : 0;

    imagemContraste.data[i] = contraste;
    imagemContraste.data[i + 1] = contraste;
    imagemContraste.data[i + 2] = contraste;
    imagemContraste.data[i + 3] = 255;
  }

  ctx.putImageData(imagemCinza, 0, 0);

  const baseCinza = canvas.toDataURL('image/png');

  ctx.putImageData(imagemContraste, 0, 0);

  const baseContraste = canvas.toDataURL('image/png');

  function extrairProtocolos(texto) {

    const normalizado = String(texto || '')
      .replace(/[OQ]/gi, '0')
      .replace(/[IL|]/g, '1');

    const encontrados = normalizado.match(
      /(?:\d[\s.]*){6}/g
    ) || [];

    return encontrados
      .map(n => n.replace(/\D/g, ''))
      .filter(n =>
        n.length === 6 &&
        n !== veiculo
      );
  }

  const resultados = [];

  const leitura1 = await Tesseract.recognize(
    baseCinza,
    'eng',
    {
      tessedit_char_whitelist: '0123456789#',
      tessedit_pageseg_mode: '11'
    }
  );

  resultados.push(...extrairProtocolos(leitura1.data.text));

  const leitura2 = await Tesseract.recognize(
    baseContraste,
    'eng',
    {
      tessedit_char_whitelist: '0123456789#',
      tessedit_pageseg_mode: '6'
    }
  );

  resultados.push(...extrairProtocolos(leitura2.data.text));

  const candidatos = [...new Set(resultados)];

  return candidatos.find(n => n.startsWith('10'))
    || candidatos[0]
    || null;
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
    const chamadosOrdenados = ordenarChamadosPorOS(chamados);
    outputEl.value = gerarTSV(chamadosOrdenados);
    adicionarAoHistorico(chamadosOrdenados);
    renderCopysFilial(chamadosOrdenados); // NOVO AQUI
    resultEl.classList.remove('hidden');
    statusEl.classList.add('hidden');
  } else {
    statusEl.textContent = 'Texto colado não contém chamados válidos no formato esperado.';
    statusEl.style.color = 'var(--danger)';
  }
}

function processarImagemOCR(file) {
  if (ocrProcessando || !file) return;

  ocrProcessando = true;

  const statusEl = document.getElementById('ocr-status');
  const resultEl = document.getElementById('ocr-resultado');
  const outputEl = document.getElementById('ocr-output');

  resultEl.classList.add('hidden');
  statusEl.classList.remove('hidden');
  statusEl.className = 'status ocr-loading';
  statusEl.textContent = 'Preparando imagem...';

  const img = new Image();
  const objectURL = URL.createObjectURL(file);

  img.onload = () => {
    iniciarTesseract(img, statusEl, resultEl, outputEl)
      .catch(err => {
        console.error('Erro no processamento:', err);
        statusEl.textContent = 'Erro ao processar imagem.';
        statusEl.style.color = 'var(--danger)';
      })
      .finally(() => {
        ocrProcessando = false;
        URL.revokeObjectURL(objectURL);
      });
  };

  img.onerror = () => {
    ocrProcessando = false;
    URL.revokeObjectURL(objectURL);
    statusEl.textContent = 'Não foi possível abrir a imagem.';
    statusEl.style.color = 'var(--danger)';
  };

  img.src = objectURL;
}

/* ===================== OCR EM DUAS ETAPAS ===================== */

async function iniciarTesseract(img, statusEl, resultEl, outputEl) {

  statusEl.textContent = 'Primeira leitura: identificando chamados...';

  const primeiraLeitura = await Tesseract.recognize(
    img,
    'por',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          statusEl.textContent =
            `Identificando chamados... ${Math.round(m.progress * 100)}%`;
        }
      }
    }
  );

  const texto = primeiraLeitura.data.text;
  const chamados = extrairDados(texto);

  if (chamados.length === 0) {
    statusEl.textContent =
      'Não foram encontrados chamados válidos na imagem.';
    statusEl.style.color = 'var(--danger)';
    return;
  }

  for (let i = 0; i < chamados.length; i++) {

    const chamado = chamados[i];

    statusEl.textContent =
      `Conferindo protocolo ${i + 1} de ${chamados.length}...`;

    try {

      const protocolo = await reconhecerProtocoloNoRecorte(
        img,
        primeiraLeitura.data,
        chamado
      );

      if (protocolo) {
        chamado.os = protocolo;
      }

    } catch (erro) {
      console.error(
        'Erro ao reconhecer protocolo:',
        chamado.veiculo,
        erro
      );
    }
  }

  const chamadosFinais = removerDuplicadosPorIdentidade(chamados);
  const chamadosOrdenados = ordenarChamadosPorOS(chamadosFinais);

  outputEl.value = gerarTSV(chamadosOrdenados);

  adicionarAoHistorico(chamadosOrdenados);
  renderCopysFilial(chamadosOrdenados); // NOVO AQUI

  resultEl.classList.remove('hidden');
  statusEl.classList.add('hidden');
}

/* ===================== IDENTIFICAÇÃO DO PROTOCOLO ===================== */

function normalizarNumeroOS(valor) {

  const numero = String(valor || '')
    .toUpperCase()
    .replace(/[OQ]/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/[^0-9]/g, '');

  if (!/^\d{6}$/.test(numero)) {
    return null;
  }

  return numero;
}

function localizarNumeroOS(linhas, indice, veiculo) {

  const indices = [];

  for (let distancia = 0; distancia <= 2; distancia++) {

    if (indice - distancia >= 0) {
      indices.push(indice - distancia);
    }

    if (distancia > 0 && indice + distancia < linhas.length) {
      indices.push(indice + distancia);
    }
  }

  for (const i of indices) {

    const linha = linhas[i];

    const encontrados = linha.matchAll(
      /#\s*([0-9OQIL|]{6})/gi
    );

    for (const encontrado of encontrados) {

      const numero = normalizarNumeroOS(encontrado[1]);

      if (numero && numero !== String(veiculo)) {
        return numero;
      }
    }
  }

  const textoJanela = indices
    .map(i => linhas[i])
    .join(' ');

  const rotulos = [
    /PROTOCOLO\D{0,15}([0-9OQIL|]{6})/i,
    /N[ÚU]MERO\s+DO\s+CHAMADO\D{0,15}([0-9OQIL|]{6})/i
  ];

  for (const regex of rotulos) {

    const resultado = textoJanela.match(regex);

    if (resultado) {

      const numero = normalizarNumeroOS(resultado[1]);

      if (numero && numero !== String(veiculo)) {
        return numero;
      }
    }
  }

  const candidatos = [];

  for (const i of indices) {

    const linha = linhas[i];

    if (
      i !== indice &&
      /(DVR\s*INOPERANTE|GPS\s*SEM\s*COMUNICA[CÇ][AÃ]O)/i.test(linha)
    ) {
      continue;
    }

    const encontrados = linha.match(
      /[0-9OQIL|]{6}/g
    ) || [];

    for (const encontrado of encontrados) {

      const numero = normalizarNumeroOS(encontrado);

      if (
        numero &&
        numero !== String(veiculo) &&
        !candidatos.includes(numero)
      ) {
        candidatos.push(numero);
      }
    }
  }

  return candidatos.find(numero => numero.startsWith('10'))
    || candidatos[0]
    || null;
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

  return chamados;
}

function gerarTSV(chamados) {
  return ordenarChamadosPorOS(chamados).map(c =>
    `${c.data}\t${c.veiculo}\t${c.os || 'NÃO IDENTIFICADA'}\t${c.filial}\t${c.camera}\t${c.codigo}`
  ).join('\n');
}

/* ===================== NOVO CARD: COPY POR FILIAL ===================== */

function renderCopysFilial(chamados) {
  const container = document.getElementById('ocr-copys-filial');
  if (!container) return;
  container.innerHTML = '';

  if (!chamados || chamados.length === 0) {
    container.innerHTML = '<div class="vazio">Nenhum chamado lido.</div>';
    return;
  }

  // Agrupa por filial
  const grupos = {};
  for (const c of chamados) {
    const f = c.filial || 'SEM FILIAL';
    if (!grupos[f]) grupos[f] = [];
    grupos[f].push(c);
  }

  // Ordena as filiais alfabeticamente
  const filiais = Object.keys(grupos).sort();

  for (const filial of filiais) {
    const div = document.createElement('div');
    div.className = 'copy-bloco';
    
    const header = document.createElement('div');
    header.className = 'copy-header';
    
    const title = document.createElement('span');
    title.className = 'copy-filial';
    title.textContent = `Filial ${filial} (${grupos[filial].length})`;
    header.appendChild(title);

    const btn = document.createElement('button');
    btn.className = 'btn btn-pequeno';
    btn.textContent = 'Copiar';
    
    // Formata a string: Veiculo; Filial; Equipamento (Problema); O.S.
    const texto = grupos[filial].map(c => {
      // Define se é Camera (DVR) ou Telemetria (GPS)
      const equipamento = c.tipoServico.includes('GPS') ? 'Telemetria' : 'Camera';
      
      // Define o texto do problema com o acento correto
      const problema = c.tipoServico.includes('GPS') 
        ? 'GPS SEM COMUNICAÇÃO' 
        : 'DVR INOPERANTE';
      
      // Se a O.S. não foi encontrada, usa 'S/N'
      const os = c.os || 'S/N';

      return `${c.veiculo}; ${os}; ${c.filial}; ${problema}; ${equipamento}`;
    }).join('\n');

    btn.onclick = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
          btn.textContent = 'Copiado!';
          setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        btn.textContent = 'Copiado!';
        setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
      }
    };
    header.appendChild(btn);
    div.appendChild(header);

    const pre = document.createElement('pre');
    pre.className = 'copy-preview';
    pre.textContent = texto;
    div.appendChild(pre);

    container.appendChild(div);
  }
}

/* ===================== UTILITÁRIOS ===================== */

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
