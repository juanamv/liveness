import React from "react";
import styleDefinitions from "./style";
import { useLiveness } from "./useLiveness";

type Props = {
  presignedUrls: Array<{
    url: string;
    step: number | string;
    type: "face" | "document";
  }>;
  email: string;
  onPhotosCapture?: (
    photos: Array<{ step: string; file: File; timestamp: number }>
  ) => void;
  onComplete?: () => void;
};

export default function FaceLiveness({
  presignedUrls,
  onPhotosCapture,
  onComplete,
}: Props) {
  const {
    videoRef,
    containerRef,
    status,
    restartVerification,
    capturedPhotos,
    isCompleted,
  } = useLiveness();
  const hasDispatchedRef = React.useRef(false);

  React.useEffect(() => {
    if (isCompleted && capturedPhotos.length > 0 && !hasDispatchedRef.current) {
      hasDispatchedRef.current = true;
      if (onPhotosCapture) {
        onPhotosCapture(capturedPhotos);
      }
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    }
  }, [isCompleted, capturedPhotos, onPhotosCapture, onComplete]);

  React.useEffect(() => {
    if (!isCompleted && capturedPhotos.length === 0) {
      hasDispatchedRef.current = false;
    }
  }, [isCompleted, capturedPhotos.length]);

  return (
    <main className="container" ref={containerRef}>
      <style>{styleDefinitions}</style>

      <h1>Verificación de Vida - Detección Facial</h1>
      <div id="video-container">
        <video
          id="video"
          ref={videoRef}
          autoPlay
          muted
          width={500}
          height={500}
        />

        <div id="face-overlay">
          <div className="face-outline" id="face-outline" />
          <div id="direction-circle" className="direction-circle">
            <div className="direction-segment segment-up" id="segment-up"></div>
            <div
              className="direction-segment segment-down"
              id="segment-down"
            ></div>
            <div
              className="direction-segment segment-left"
              id="segment-left"
            ></div>
            <div
              className="direction-segment segment-right"
              id="segment-right"
            ></div>
          </div>
        </div>
      </div>

      <div className="status" id="status">
        {status}
      </div>

      <div className="progress-container">
        <div className="progress-step" id="step-center">
          <span className="step-icon">👁️</span>
          <span className="step-text">Centro</span>
        </div>
        <div className="progress-arrow">→</div>
        <div className="progress-step" id="step-left">
          <span className="step-icon">⬅️</span>
          <span className="step-text">Izquierda</span>
        </div>
        <div className="progress-arrow">→</div>
        <div className="progress-step" id="step-up">
          <span className="step-icon">⬆️</span>
          <span className="step-text">Arriba</span>
        </div>
        <div className="progress-arrow">→</div>
        <div className="progress-step" id="step-right">
          <span className="step-icon">➡️</span>
          <span className="step-text">Derecha</span>
        </div>
        <div className="progress-arrow">→</div>
        <div className="progress-step" id="step-down">
          <span className="step-icon">⬇️</span>
          <span className="step-text">Abajo</span>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          id="restart-btn"
          onClick={restartVerification}
          style={{
            background: "#dc3545",
            color: "white",
            padding: "10px 20px",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
            fontSize: 14,
            marginRight: 10,
          }}
        >
          Reiniciar
        </button>
        <a
          href="/"
          style={{
            background: "#6c757d",
            color: "white",
            padding: "10px 20px",
            textDecoration: "none",
            borderRadius: 5,
            fontSize: 14,
          }}
        >
          Inicio
        </a>
      </div>
    </main>
  );
}
