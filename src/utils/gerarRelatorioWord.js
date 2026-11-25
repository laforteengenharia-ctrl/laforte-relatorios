import {
  calcularTamanhoCm,
  agruparLinhas,
  paginarPorAltura,
  formatarLegendas,
  identificarFormato,
} from "./layoutFotos";

const ESPACAMENTO_FOTOS_CM = 0.6;
const CM_TO_PX = 96 / 2.54;
const CM_TO_TWIPS = 1440 / 2.54;

function dimensoesExibicao(item) {
  // calcularTamanhoCm é a única fonte da verdade (compartilhada com a
  // pré-visualização em HTML) para o tamanho de exibição da foto dentro do
  // seu formato; aqui só convertemos o resultado de cm para pixels, unidade
  // usada pelo ImageRun do docx.
  const tamanho = calcularTamanhoCm({
    largura: item.image.width,
    altura: item.image.height,
    formato: item.formato,
  });
  return { width: tamanho.largura * CM_TO_PX, height: tamanho.altura * CM_TO_PX };
}

function lerDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (!match) throw new Error("A imagem não veio em um formato válido.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { mimeType: match[1], bytes };
}

function abrirImagem(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível decodificar uma das fotos."));
    image.src = dataUrl;
  });
}

async function prepararImagem(dataUrl) {
  const image = await abrirImagem(dataUrl);
  const maxWidth = 1400;
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Não foi possível preparar uma foto para o Word.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((resultado) => resultado ? resolve(resultado) : reject(new Error("Falha ao comprimir uma foto.")), "image/jpeg", 0.74);
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
    formato: identificarFormato(image.naturalWidth, image.naturalHeight),
  };
}

function criarLinhaFotos(row, docx) {
  const {
    AlignmentType,
    BorderStyle,
    ImageRun,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TableLayoutType,
    VerticalAlign,
    WidthType,
  } = docx;
  // dimensoesExibicao é a única fonte da verdade para o tamanho da foto: usar os
  // mesmos valores aqui para a imagem e para a largura da célula/borda evita que a
  // célula cresça (com a regra nova de fotos horizontais maiores) enquanto a imagem
  // dentro dela continua limitada ao tamanho antigo, menor.
  const tamanhos = row.map((item) => dimensoesExibicao(item));
  const photoWidths = tamanhos.map((tamanho) => tamanho.width / CM_TO_PX);
  const spacerWidth = ESPACAMENTO_FOTOS_CM;
  const columnWidths = [];
  const cells = [];
  row.forEach((item, index) => {
    const cellWidthCm = photoWidths[index];
    const imageWidth = Math.max(1, Math.round(tamanhos[index].width));
    const imageHeight = Math.max(1, Math.round(tamanhos[index].height));
    // Borda da foto como borda da célula da tabela (1pt = 8 oitavos de ponto):
    // mais confiável entre Word/Google Docs do que o contorno (outline) da imagem,
    // que pode se perder na conversão do Google Docs ao abrir a cópia do Drive.
    const border = { style: BorderStyle.SINGLE, size: 8, color: "111111" };
    const photoWidthDxa = Math.round(cellWidthCm * CM_TO_TWIPS);
    columnWidths.push(photoWidthDxa);
    cells.push(new TableCell({
      width: { size: photoWidthDxa, type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      verticalAlign: VerticalAlign.CENTER,
      borders: { top: border, bottom: border, left: border, right: border },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 1 },
        children: [new ImageRun({
          data: item.image.bytes,
          transformation: { width: imageWidth, height: imageHeight },
          type: "jpg",
        })],
      })],
    }));
    if (index < row.length - 1) {
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      const spacerDxa = Math.round(spacerWidth * CM_TO_TWIPS);
      columnWidths.push(spacerDxa);
      cells.push(new TableCell({
        width: { size: spacerDxa, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({ children: [] })],
      }));
    }
  });
  const tableWidth = photoWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, row.length - 1) * spacerWidth;
  return new Table({
    rows: [new TableRow({ children: cells })],
    width: { size: Math.round(tableWidth * CM_TO_TWIPS), type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  });
}

export async function gerarRelatorioWord({
  contratoNumero,
  contratoNome,
  numeroMedicao,
  frentes,
  fotos,
  carregarImagem,
  logo,
  simbolo,
  progresso = () => {},
}) {
  const docx = await import("docx");
  const {
    AlignmentType,
    Document,
    Header,
    ImageRun,
    Packer,
    Paragraph,
    TextRun,
    PageBreak,
    WidthType,
  } = docx;

  const frentePorId = new Map(frentes.map((front) => [Number(front.id), front]));
  const imagens = [];
  for (let index = 0; index < fotos.length; index += 1) {
    const foto = fotos[index];
    progresso(index + 1, fotos.length);
    const dataUrl = await carregarImagem(foto);
    const imagem = await prepararImagem(dataUrl);
    imagens.push({ foto, front: frentePorId.get(Number(foto.frente_id)), image: imagem, formato: imagem.formato });
  }

  const children = [];
  let primeiraPagina = true;
  const frentesOrdenadas = [...frentes].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
  for (const front of frentesOrdenadas) {
    const frontPhotos = imagens
      .filter((item) => Number(item.foto.frente_id) === Number(front.id))
      .sort((a, b) => Number(a.foto.ordem || 0) - Number(b.foto.ordem || 0));
    if (!frontPhotos.length) continue;

    const primeiraFrenteDoRelatorio = primeiraPagina;
    const rows = agruparLinhas(frontPhotos);
    // A primeira foto do relatório inteiro sai sozinha na página de abertura; o restante
    // das fotos dessa frente começa em uma página própria (há um PageBreak logo abaixo),
    // então não compete pela mesma cota de fotos por página.
    if (primeiraPagina && rows.length) {
      const fotoUnica = rows[0].shift();
      if (rows[0].length === 0) rows.shift();
      children.push(new Paragraph({
        spacing: { before: 400, after: 600 },
        children: [new TextRun({ text: "RELATÓRIO FOTOGRÁFICO", font: "Arial", size: 24 })],
      }));
      children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `CONTRATO: ${contratoNumero} — ${contratoNome}`, font: "Arial", size: 22 })] }));
      children.push(new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: `MEDIÇÃO ${numeroMedicao}`, font: "Arial", size: 22 })] }));
      children.push(new Paragraph({
        spacing: { before: 100, after: 600 },
        children: [new TextRun({ text: front.nome || "Frente", bold: true, font: "Arial", size: 24 })],
      }));
      children.push(criarLinhaFotos([fotoUnica], docx));
      const legendaInicial = formatarLegendas([fotoUnica.foto.legenda]);
      if (legendaInicial) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 360 },
          children: [new TextRun({ text: legendaInicial, bold: true, font: "Arial", size: 20 })],
        }));
      }
      primeiraPagina = false;
    }
    // Orçamento de altura por página (ver layoutFotos.js): cada linha "pesa" a
    // altura do seu formato, e uma página recebe linhas até o orçamento ser
    // atingido, sem misturar formatos na mesma linha.
    const paginasDeLinhas = paginarPorAltura(rows);
    let start = 0;
    for (const pageRows of paginasDeLinhas) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      if (start === 0 && !primeiraFrenteDoRelatorio) {
        children.push(new Paragraph({
          spacing: { before: 100, after: 600 },
          children: [new TextRun({ text: front.nome || "Frente", bold: true, font: "Arial", size: 24 })],
        }));
      }
      pageRows.forEach((row, index) => {
        children.push(criarLinhaFotos(row, docx));
        if (index === 0) {
          const caption = formatarLegendas(pageRows.flat().map((item) => item.foto.legenda));
          if (caption) {
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 600, after: 360 },
              children: [new TextRun({ text: caption, bold: true, font: "Arial", size: 20 })],
            }));
          } else if (pageRows.length > 1) {
            children.push(new Paragraph({ spacing: { after: 900 }, children: [] }));
          }
        } else if (index < pageRows.length - 1) {
          children.push(new Paragraph({ spacing: { after: 90 }, children: [] }));
        }
      });
      start += pageRows.length;
      primeiraPagina = false;
    }
  }

  const logoData = lerDataUrl(logo).bytes;
  const simboloData = lerDataUrl(simbolo).bytes;
  const header = new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new ImageRun({ data: simboloData, transformation: { width: 72, height: 72 }, type: "png" }),
        new TextRun({ text: "  " }),
        new ImageRun({ data: logoData, transformation: { width: 460, height: 31 }, type: "png" }),
      ],
    })],
  });

  const document = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 2000, right: 450, bottom: 500, left: 450, header: 360, footer: 360 },
        },
      },
      headers: { default: header },
      children,
    }],
  });
  return Packer.toBlob(document);
}
