const LARGURA_CONTEUDO_CM = 19.4;
const FORMATS = [
  { type: 1, ratio: 15 / 8.44, width: 15, height: 8.44 },
  { type: 2, ratio: 13.29 / 10, width: 13.29, height: 10 },
  { type: 3, ratio: 7.53 / 10, width: 7.53, height: 10 },
  { type: 4, ratio: 5.62 / 10, width: 5.62, height: 10 },
  { type: 5, ratio: 1600 / 600, width: 17.4, height: 6.525 },
];
const CM_TO_PX = 96 / 2.54;
const CM_TO_TWIPS = 1440 / 2.54;

function identificarFormato(width, height) {
  if (!width || !height) return FORMATS[1];
  const ratio = width / height;
  return FORMATS.reduce((best, item) =>
    Math.abs(Math.log(ratio / item.ratio)) < Math.abs(Math.log(ratio / best.ratio)) ? item : best
  );
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
  const maxWidth = 1800;
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
    canvas.toBlob((resultado) => resultado ? resolve(resultado) : reject(new Error("Falha ao comprimir uma foto.")), "image/jpeg", 0.82);
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
    format: identificarFormato(image.naturalWidth, image.naturalHeight),
  };
}

function formatarLegendas(fotos) {
  const unicas = [];
  const chaves = new Set();
  fotos.forEach(({ foto }) => {
    const text = String(foto.legenda || "").trim();
    const key = text.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
    if (text && !chaves.has(key)) {
      chaves.add(key);
      unicas.push(text);
    }
  });
  const legendas = unicas.map((text, index) => {
    const trimmed = text.trim();
    return index === 0
      ? trimmed
      : trimmed.charAt(0).toLocaleLowerCase("pt-BR") + trimmed.slice(1);
  });
  if (legendas.length < 2) return legendas[0] || "";
  if (legendas.length === 2) return `${legendas[0]} e ${legendas[1]}`;
  return `${legendas.slice(0, -1).join(", ")} e ${legendas[legendas.length - 1]}`;
}

function agruparLinhas(items) {
  const rows = [];
  let current = [];
  let currentWidth = 0;
  items.forEach((item) => {
    const needed = item.format.width + (current.length ? 1.8 : 0);
    const itemNeedsOwnRow = item.format.type === 1 || item.format.type === 2;
    const currentNeedsOwnRow = current.some((currentItem) => currentItem.format.type === 1 || currentItem.format.type === 2);
    if (current.length && (itemNeedsOwnRow || currentNeedsOwnRow || currentWidth + needed > LARGURA_CONTEUDO_CM + 0.01)) {
      rows.push(current);
      current = [];
      currentWidth = 0;
    }
    const gap = current.length ? 1.8 : 0;
    current.push(item);
    currentWidth += item.format.width + gap;
  });
  if (current.length) rows.push(current);
  return rows;
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
  const photoWidths = row.map((item) => item.format.width);
  const spacerWidth = 1.8;
  const columnWidths = [];
  const cells = [];
  row.forEach((item, index) => {
    const cellWidthCm = photoWidths[index];
    const maxWidthPx = Math.max(1, cellWidthCm * CM_TO_PX);
    const maxHeightPx = item.format.height * CM_TO_PX;
    const scale = Math.min(maxWidthPx / item.image.width, maxHeightPx / item.image.height);
    const imageWidth = Math.max(1, Math.round(item.image.width * scale));
    const imageHeight = Math.max(1, Math.round(item.image.height * scale));
    const border = { style: BorderStyle.SINGLE, size: 8, color: "111111" };
    columnWidths.push(Math.round(cellWidthCm * CM_TO_TWIPS));
    cells.push(new TableCell({
      width: { size: columnWidths[index], type: WidthType.DXA },
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
    imagens.push({ foto, front: frentePorId.get(Number(foto.frente_id)), image: imagem, format: imagem.format });
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
      const legendaInicial = formatarLegendas([fotoUnica]);
      if (legendaInicial) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 360 },
          children: [new TextRun({ text: legendaInicial, bold: true, font: "Arial", size: 20 })],
        }));
      }
      primeiraPagina = false;
    }
    const panoramicOnly = rows.length > 0 && rows.every((row) => row.every((item) => item.format.type === 5));
    const rowsPerPage = panoramicOnly ? 3 : 2;
    for (let start = 0; start < rows.length; start += rowsPerPage) {
      const pageRows = rows.slice(start, start + rowsPerPage);
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
          const caption = formatarLegendas(pageRows.flat());
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
