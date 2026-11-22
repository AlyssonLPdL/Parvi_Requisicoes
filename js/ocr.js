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



/* ===================== OCR REFORÇADO DO PROTOCOLO ===================== */

async function reconhecerProtocoloNoRecorte(img, dadosOCR, chamado) {

  const palavras = dadosOCR.words || [];
  const veiculo = String(chamado.veiculo);

  // Localiza o veículo na primeira leitura
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

  // Recorte dinâmico, proporcional ao tamanho da fonte
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

  // Ampliação em 4 vezes
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

  // Cria duas versões para comparação
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

    // Preserva detalhes na versão em cinza
    imagemCinza.data[i] = cinza;
    imagemCinza.data[i + 1] = cinza;
    imagemCinza.data[i + 2] = cinza;

    // Alto contraste na segunda versão
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

  console.log('PROTOCOLO - RECORTE:', {
    veiculo,
    tamanhoOriginal: `${img.width}x${img.height}`,
    tamanhoRecorte: `${canvas.width}x${canvas.height}`,
    posicaoVertical: yInicial
  });

  // Função para extrair candidatos de seis dígitos
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

  // Primeira tentativa: escala de cinza
  const leitura1 = await Tesseract.recognize(
    baseCinza,
    'eng',
    {
      tessedit_char_whitelist: '0123456789#',
      tessedit_pageseg_mode: '11'
    }
  );

  console.log(
    'PROTOCOLO - LEITURA CINZA:',
    leitura1.data.text
  );

  resultados.push(...extrairProtocolos(leitura1.data.text));

  // Segunda tentativa: alto contraste
  const leitura2 = await Tesseract.recognize(
    baseContraste,
    'eng',
    {
      tessedit_char_whitelist: '0123456789#',
      tessedit_pageseg_mode: '6'
    }
  );

  console.log(
    'PROTOCOLO - LEITURA CONTRASTE:',
    leitura2.data.text
  );

  resultados.push(...extrairProtocolos(leitura2.data.text));

  // Elimina duplicados
  const candidatos = [...new Set(resultados)];

  console.log(
    'PROTOCOLO - CANDIDATOS:',
    veiculo,
    candidatos
  );

  // Prioriza protocolos no padrão 10xxxx
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

  // PRIMEIRA LEITURA: imagem completa
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

  console.log('PRIMEIRA LEITURA:', texto);

  const chamados = extrairDados(texto);

  if (chamados.length === 0) {
    statusEl.textContent =
      'Não foram encontrados chamados válidos na imagem.';
    statusEl.style.color = 'var(--danger)';
    return;
  }

  // SEGUNDA LEITURA: recorte individual dos protocolos
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

      // A segunda leitura tem prioridade
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

  // Atualiza resultado depois das duas leituras
  outputEl.value = gerarTSV(chamados);

  adicionarAoHistorico(chamados);

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

  // Protocolo do TomTicket: normalmente 6 dígitos
  if (!/^\d{6}$/.test(numero)) {
    return null;
  }

  // Não fazer conversões automáticas de 410 para 10.
  // O protocolo deve ser preservado conforme identificado.

  return numero;
}


function localizarNumeroOS(linhas, indice, veiculo) {

  // Examina a linha do chamado e linhas próximas
  const indices = [];

  for (let distancia = 0; distancia <= 2; distancia++) {

    if (indice - distancia >= 0) {
      indices.push(indice - distancia);
    }

    if (distancia > 0 && indice + distancia < linhas.length) {
      indices.push(indice + distancia);
    }
  }

  // Prioridade 1: número precedido pelo símbolo #
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

  // Prioridade 2: protocolo identificado por uma palavra
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

  // Prioridade 3: número de seis dígitos nas linhas próximas
  const candidatos = [];

  for (const i of indices) {

    const linha = linhas[i];

    // Não pegar números pertencentes a outro chamado
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

  // Prioriza protocolos que começam com 10
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
