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

/** Procura um QR code na imagem. */
export async function findQrCode(canvas: HTMLCanvasElement): Promise<string | null> {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width === 0) return null;
  const { readBarcodes } = await loadReader();
  const results = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), {
    formats: ["QRCode"],
    tryHarder: true,
    maxNumberOfSymbols: 1,
  });
  return results.find((result) => result.isValid)?.text ?? null;
}

async function findQrIn(bitmap: ImageBitmap): Promise<string | null> {
  for (const side of QR_SIDES) {
    const text = await findQrCode(canvasFrom(bitmap, bitmap.width, bitmap.height, side)).catch(() => null);
    if (text) return text;
  }
  return null;
}

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

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  // O navegador já aplica a rotação gravada pela câmera (EXIF).
  const bitmap = await createImageBitmap(file);
  try {
    const qrText = await findQrIn(bitmap);
    const small = Math.max(bitmap.width, bitmap.height) <= MAX_SIDE;
    const upload =
      file.type === "image/jpeg" && small && file.size <= MAX_ORIGINAL_BYTES
        ? file
        : await canvasToJpeg(canvasFrom(bitmap, bitmap.width, bitmap.height, MAX_SIDE));
    return { base64: await blobToBase64(upload), qrText };
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

/** Lê QR codes da câmera ao vivo, alguns quadros por segundo, até achar um. */
export function scanVideo(video: HTMLVideoElement, onFound: (text: string) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const text = await findQrCode(canvasFrom(video, video.videoWidth, video.videoHeight, 1280)).catch(() => null);
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
