import { useEffect, useRef } from "react";
import { type CodeKind, scanVideo } from "../data/receiptImage";

/** Câmera ao vivo procurando um código: o QR do cupom fiscal ou o código de barras de um produto. */
export function CodeScanner({
  kind,
  onFound,
  onFail,
}: {
  kind: CodeKind;
  onFound: (text: string) => void;
  onFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopScan: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        stopScan = scanVideo(video, (text) => onFoundRef.current(text), kind);
      } catch {
        if (!cancelled) onFailRef.current();
      }
    })();
    return () => {
      cancelled = true;
      stopScan?.();
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [kind]);

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" muted playsInline aria-label="Câmera" />
      <span className={kind === "product" ? "scanner__frame scanner__frame--wide" : "scanner__frame"} aria-hidden="true" />
    </div>
  );
}
