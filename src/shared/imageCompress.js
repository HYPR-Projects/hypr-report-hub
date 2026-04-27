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
 * Detecta se uma imagem é colorida ou monocromática (preto/branco/cinza).
 * Usado pra decidir se aplica filter:invert entre temas dark/light:
 *  - Monocromática: invert faz sentido (logo branca → preta no light).
 *  - Colorida: invert destrói as cores (PicPay roxo → amarelo).
 *
 * Estratégia: desenha em canvas pequeno, amostra pixels, calcula saturação
 * via diferença max-min de R/G/B. Threshold conservador pra evitar falsos
 * positivos com sombras/anti-aliasing.
 *
 * Retorna Promise<boolean>:
 *   true  → imagem tem cor (não inverter)
 *   false → monocromática (pode inverter)
 *
 * Em caso de erro (CORS, imagem inválida), assume colorido (safer default
 * — não distorce o logo do cliente).
 */
export function detectIsColored(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        // Canvas pequeno é suficiente pra amostragem estatística.
        const w = 64, h = Math.max(1, Math.round(64 * (img.height / img.width)));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(true);
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let coloredPixels = 0;
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 32) continue; // ignora pixels transparentes
          opaquePixels++;
          // Saturação simples: max(r,g,b) - min(r,g,b).
          // Threshold de 18/255 (~7%) tolera ruído de anti-aliasing
          // sem deixar passar cores reais.
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          if (sat > 18) coloredPixels++;
        }
        if (opaquePixels === 0) return resolve(true);
        // Se mais de 5% dos pixels opacos têm cor, considera logo colorido.
        resolve(coloredPixels / opaquePixels > 0.05);
      } catch {
        resolve(true);
      }
    };
    img.onerror = () => resolve(true);
    img.src = src;
  });
}

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
