/**
 * Prepara a foto do cupom no próprio aparelho: reduz para enviar rápido
 * e procura o QR code da NFC-e na mesma foto (ZXing em WebAssembly).
 */

/** Lado maior da foto enviada; o suficiente para ler a letra miúda do cupom. */
const MAX_SIDE = 2048;
/** Foto JPEG até este tamanho vai como está: recomprimir borra a letra miúda. */
const MAX_ORIGINAL_BYTES = 3 * 1024 * 1024;
/** Tamanhos em que o QR é procurado. */
const QR_SIDES = [2048, 1200, 800];

type Reader = typeof import("zxing-wasm/reader");
let readerPromise: Promise<Reader> | null = null;

/** O leitor (cerca de 1 MB) só é baixado quando alguém vai ler um cupom, e vem do próprio app. */
function loadReader(): Promise<Reader> {
  readerPromise ??= Promise.all([
    import("zxing-wasm/reader"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]).then(([reader, wasm]) => {
    reader.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasm.default : prefix + path),
      },
    });
    return reader;
  });
  readerPromise.catch(() => {
    readerPromise = null;
  });
  return readerPromise;
}

function canvasFrom(source: CanvasImageSource, width: number, height: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d", { willReadFrequently: true })?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** O que procurar: o QR code da NFC-e ou o código de barras de um produto (EAN/UPC). */
export type CodeKind = "qr" | "product";

const FORMATS = {
  qr: ["QRCode"],
  product: ["EAN-13", "EAN-8", "UPC-A", "UPC-E"],
} as const;

/** Procura um código na imagem. */
export async function findCode(canvas: HTMLCanvasElement, kind: CodeKind = "qr"): Promise<string | null> {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width === 0) return null;
  const { readBarcodes } = await loadReader();
  const results = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), {
    formats: [...FORMATS[kind]],
    tryHarder: true,
    maxNumberOfSymbols: 1,
  });
  return results.find((result) => result.isValid)?.text ?? null;
}

/** Procura um QR code na imagem. */
export const findQrCode = (canvas: HTMLCanvasElement) => findCode(canvas, "qr");

async function findIn(bitmap: ImageBitmap, kind: CodeKind): Promise<string | null> {
  for (const side of QR_SIDES) {
    const text = await findCode(canvasFrom(bitmap, bitmap.width, bitmap.height, side), kind).catch(() => null);
    if (text) return text;
  }
  return null;
}

const findQrIn = (bitmap: ImageBitmap) => findIn(bitmap, "qr");

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não consegui preparar a foto."))), "image/jpeg", 0.92);
  });
}

export interface PreparedPhoto {
  /** JPEG em base64, pronto para a leitura. */
  base64: string;
  /** Texto do QR code, se apareceu na foto. */
  qrText: string | null;
}

/** A foto do tamanho certo para a IA, em base64. */
async function uploadFrom(file: Blob, bitmap: ImageBitmap): Promise<string> {
  const small = Math.max(bitmap.width, bitmap.height) <= MAX_SIDE;
  const upload =
    file.type === "image/jpeg" && small && file.size <= MAX_ORIGINAL_BYTES
      ? file
      : await canvasToJpeg(canvasFrom(bitmap, bitmap.width, bitmap.height, MAX_SIDE));
  return blobToBase64(upload);
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  // O navegador já aplica a rotação gravada pela câmera (EXIF).
  const bitmap = await createImageBitmap(file);
  try {
    const qrText = await findQrIn(bitmap);
    return { base64: await uploadFrom(file, bitmap), qrText };
  } finally {
    bitmap.close();
  }
}

/** Foto de uma lista escrita: só reduz, sem procurar QR code. */
export async function listPhotoBase64(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    return await uploadFrom(file, bitmap);
  } finally {
    bitmap.close();
  }
}

/** Só lê o QR de uma foto (quando a câmera ao vivo não está disponível). */
export async function qrFromPhoto(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await findQrIn(bitmap);
  } finally {
    bitmap.close();
  }
}

/** Só lê o código de barras de um produto numa foto (quando a câmera ao vivo não abre). */
export async function barcodeFromPhoto(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await findIn(bitmap, "product");
  } finally {
    bitmap.close();
  }
}

/** Lê códigos da câmera ao vivo, alguns quadros por segundo, até achar um. */
export function scanVideo(video: HTMLVideoElement, onFound: (text: string) => void, kind: CodeKind = "qr"): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const text = await findCode(canvasFrom(video, video.videoWidth, video.videoHeight, 1280), kind).catch(() => null);
      if (text && !stopped) {
        onFound(text);
        return;
      }
    }
    timer = setTimeout(() => void tick(), 200);
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
