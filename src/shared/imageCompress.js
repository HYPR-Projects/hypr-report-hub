/**
 * Compressão client-side de imagens antes do upload.
 *
 * Estratégia:
 *  - SVG passa direto (já é texto leve, perda de qualidade ao re-encodar
 *    canvas seria pior que ganho de tamanho).
 *  - PNG: desenha em canvas redimensionado (max 600px) e re-exporta como
 *    PNG. Lossless, mas redimensionar uma logo de 3000px → 600px reduz
 *    o arquivo a poucos % do original.
 *  - JPG/JPEG: mesma coisa, mas exporta JPEG com quality 0.85 (canvas
 *    aceita o param de quality apenas em formatos lossy).
 *
 * Retorna uma Promise<string> com o data URI base64 final, pronto pra
 * mandar pro backend. Lança erro se o arquivo for muito grande, formato
 * inválido ou imagem corrompida.
 */

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_WIDTH = 600;

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida ou corrompida"));
    img.src = src;
  });

/**
 * Comprime uma imagem (File). SVG passa sem processar.
 * Lança erro com mensagem amigável se o arquivo for inválido.
 *
 * @param {File} file
 * @param {{ maxWidth?: number, quality?: number, maxBytes?: number }} opts
 * @returns {Promise<string>} data URI base64
 */
export async function compressImageFile(file, opts = {}) {
  const maxWidth = opts.maxWidth || DEFAULT_MAX_WIDTH;
  const quality = opts.quality ?? 0.85;
  const maxBytes = opts.maxBytes || MAX_FILE_SIZE_BYTES;

  if (!file) throw new Error("Nenhum arquivo selecionado");

  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`Arquivo muito grande. Limite: ${mb}MB.`);
  }

  // SVG passa direto — comprimir via canvas perde qualidade vetorial e
  // o tamanho original já é pequeno (texto).
  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  if (isSvg) {
    return fileToDataUrl(file);
  }

  // Raster: desenha em canvas redimensionado e re-exporta.
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(1, maxWidth / img.width);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem");

  // Habilita smoothing pra redimensionamento decente (Lanczos-ish via browser)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  // PNG preserva transparência (logos costumam precisar). JPEG só pra
  // fontes que já vieram JPEG (quality lossy faz sentido).
  const outputType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  // canvas.toDataURL ignora `quality` em PNG — mas passar não quebra.
  return canvas.toDataURL(outputType, quality);
}
