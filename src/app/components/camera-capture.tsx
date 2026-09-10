import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, X, RotateCcw, Check, FlipHorizontal, AlertCircle } from "lucide-react";

type CaptureMode = "selfie" | "signature";

interface CameraCaptureProps {
  mode: CaptureMode;
  onCapture: (file: File) => void;
  onClose: () => void;
  overlayImageSrc?: string;
}

export function CameraCapture({ mode, onCapture, onClose, overlayImageSrc }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<"preview" | "captured">("preview");
  const [capturedDataUrl, setCapturedDataUrl] = useState<string>("");
  const [mirrored, setMirrored] = useState(mode === "selfie");
  const [error, setError] = useState<string>("");
  const [flash, setFlash] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    mode === "selfie" ? "user" : "environment"
  );
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const isPortrait = mode === "selfie";
  // selfie: 2421×3292 aspect → ~0.735 wide:tall (portrait)
  // signature: 420×123 aspect → ~3.41 wide:tall (landscape)
  const aspectRatio = isPortrait ? 3 / 4 : 420 / 123;

  const startCamera = useCallback(async (facing: "user" | "environment") => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setError("");
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          ...(isPortrait
            ? { width: { ideal: 1080 }, height: { ideal: 1440 } }
            : { width: { ideal: 1920 }, height: { ideal: 560 } }),
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Detect if multiple cameras exist
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoCams = devices.filter((d) => d.kind === "videoinput");
      setHasMultipleCameras(videoCams.length > 1);
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permissions and try again."
          : err?.name === "NotFoundError"
          ? "No camera found on this device."
          : "Could not access camera. Please try uploading a file instead.";
      setError(msg);
    }
  }, [isPortrait]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, startCamera]);

  const flipCamera = () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    setMirrored(next === "user");
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Export at the exact target dimensions
    const exportW = isPortrait ? 2421 : 420;
    const exportH = isPortrait ? 3292 : 123;

    canvas.width = exportW;
    canvas.height = exportH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill white for signature (luminance bg removal needs a clean base)
    if (!isPortrait) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, exportW, exportH);
    }

    // Cover-crop: centre the video inside the export canvas
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(exportW / vw, exportH / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    const dx = (exportW - drawW) / 2;
    const dy = (exportH - drawH) / 2;

    if (mirrored) {
      ctx.save();
      ctx.translate(exportW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, dx - exportW + drawW, dy, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(video, dx, dy, drawW, drawH);
    }

    // Flash animation
    setFlash(true);
    setTimeout(() => setFlash(false), 300);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedDataUrl(dataUrl);
    setPhase("captured");
  };

  const retake = () => {
    setCapturedDataUrl("");
    setPhase("preview");
  };

  const confirm = () => {
    if (!capturedDataUrl) return;
    canvas2file(capturedDataUrl, mode === "selfie" ? "selfie-capture.jpg" : "signature-capture.jpg");
  };

  const canvas2file = (dataUrl: string, filename: string) => {
    const byteStr = atob(dataUrl.split(",")[1]);
    const mime = dataUrl.split(",")[0].split(":")[1].split(";")[0];
    const buf = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) buf[i] = byteStr.charCodeAt(i);
    const file = new File([buf], filename, { type: mime });
    onCapture(file);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="camera-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="relative w-full flex flex-col items-center gap-4"
          style={{ maxWidth: isPortrait ? 380 : 640 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="w-full flex items-center justify-between px-1">
            <div>
              <p className="text-white text-base tracking-tight">
                {mode === "selfie" ? "Take a selfie" : "Photograph signature"}
              </p>
              <p className="text-white/45 text-xs mt-0.5">
                {mode === "selfie"
                  ? "Position your face within the guide, then capture."
                  : "Hold the camera over your handwritten signature."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-white/15 bg-white/10 text-white/70 hover:text-white hover:bg-white/15 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Viewfinder */}
          <div
            className="relative w-full overflow-hidden rounded-2xl border border-white/15"
            style={{
              aspectRatio: isPortrait ? "3/4" : `${420 / 123}`,
              background: "#0a0a0a",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 24px 64px -12px rgba(0,0,0,0.7)",
            }}
          >
            {/* Live preview */}
            {phase === "preview" && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: mirrored ? "scaleX(-1)" : "none" }}
              />
            )}

            {/* Captured still */}
            {phase === "captured" && capturedDataUrl && (
              <img
                src={capturedDataUrl}
                alt="Captured"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Guide overlay for selfie */}
            {phase === "preview" && mode === "selfie" && overlayImageSrc && (
              <img
                src={overlayImageSrc}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-60"
                style={{ mixBlendMode: "screen" }}
              />
            )}

            {/* Signature guide for signature mode */}
            {phase === "preview" && mode === "signature" && (
              <div className="pointer-events-none absolute inset-4 rounded-lg border border-dashed border-white/30 flex items-center justify-center">
                <span className="text-white/30 text-xs mono uppercase tracking-widest">
                  Signature area
                </span>
              </div>
            )}

            {/* Flash */}
            <AnimatePresence>
              {flash && (
                <motion.div
                  key="flash"
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.28 }}
                  className="pointer-events-none absolute inset-0 bg-white"
                />
              )}
            </AnimatePresence>

            {/* Corner brackets */}
            {phase === "preview" && (
              <>
                {[
                  "top-3 left-3 border-t border-l",
                  "top-3 right-3 border-t border-r",
                  "bottom-3 left-3 border-b border-l",
                  "bottom-3 right-3 border-b border-r",
                ].map((cls, i) => (
                  <div
                    key={i}
                    className={`pointer-events-none absolute w-5 h-5 ${cls} border-white/50 rounded-sm`}
                  />
                ))}
              </>
            )}

            {/* Error state */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/70">
                <AlertCircle className="w-8 h-8 text-rose-300" />
                <p className="text-white/80 text-sm">{error}</p>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="text-xs text-white/60 hover:text-white underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Controls */}
          <div className="w-full flex items-center justify-center gap-6">
            {phase === "preview" ? (
              <>
                {/* Mirror toggle */}
                <button
                  onClick={() => setMirrored((m) => !m)}
                  title="Toggle mirror"
                  className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
                    mirrored
                      ? "border-white/30 bg-white/15 text-white"
                      : "border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/25"
                  }`}
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>

                {/* Shutter */}
                <motion.button
                  onClick={capture}
                  disabled={!!error}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.93 }}
                  className="w-16 h-16 rounded-full border-4 border-white bg-white/90 flex items-center justify-center shadow-[0_0_0_2px_rgba(255,255,255,0.15)] disabled:opacity-40 transition-opacity"
                >
                  <Camera className="w-6 h-6 text-black" strokeWidth={2} />
                </motion.button>

                {/* Flip camera */}
                {hasMultipleCameras ? (
                  <button
                    onClick={flipCamera}
                    title="Switch camera"
                    className="w-10 h-10 rounded-full border border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-10 h-10" />
                )}
              </>
            ) : (
              <>
                {/* Retake */}
                <button
                  onClick={retake}
                  className="flex items-center gap-2 px-5 h-10 rounded-full border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-white/30 text-xs mono uppercase tracking-wider transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retake
                </button>

                {/* Use this photo */}
                <motion.button
                  onClick={confirm}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-6 h-10 rounded-full bg-white text-black text-xs mono uppercase tracking-wider transition-colors hover:bg-white/90"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Use photo
                </motion.button>
              </>
            )}
          </div>

          {/* Hint */}
          <p className="text-white/30 text-[10px] text-center mono uppercase tracking-[0.14em]">
            {phase === "preview"
              ? mode === "selfie"
                ? "Camera is only used locally — no data is sent anywhere"
                : "Flat lighting + dark ink on white paper gives best results"
              : "Looks good? Hit “Use photo” or retake if needed"}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Trigger button ────────────────────────────────────────────────────── */

export function CameraButton({
  onClick,
  label = "Use camera",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-white/65 hover:text-white hover:border-white/30 hover:bg-white/10 text-[10px] mono uppercase tracking-[0.14em] transition-colors"
    >
      <Camera className="w-3 h-3" strokeWidth={2} />
      {label}
    </motion.button>
  );
}
