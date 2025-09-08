import { useEffect, useRef, useState } from "react";

type LivenessState = {
  center: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  completed: boolean;
  completedCount: number;
  currentInstruction: string;
};

type CapturedPhoto = {
  step: string;
  file: File;
  timestamp: number;
};

type Movement = "center" | "left" | "right" | "up" | "down";

export function useLiveness() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const displaySizeRef = useRef({ width: 0, height: 0 });
  const faceapiRef = useRef<any>(null);

  const detectionCountRef = useRef(0);
  const lastOrientationRef = useRef("");
  const orientationStabilityCountRef = useRef(0);
  const capturedPhotosRef = useRef<CapturedPhoto[]>([]);

  const [status, setStatus] = useState(
    "Cargando modelos e inicializando cámara..."
  );
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);

  const livenessStateRef = useRef<LivenessState>({
    center: false,
    left: false,
    right: false,
    up: false,
    down: false,
    completed: false,
    completedCount: 0,
    currentInstruction: "Realiza movimientos de cabeza en cualquier orden",
  });

  const requiredMovements = useRef<Movement[]>([
    "center",
    "left",
    "up",
    "right",
    "down",
  ]);
  const totalMovements = requiredMovements.current.length;
  const DETECTION_THRESHOLD = 3;

  function updateStatus(message: string) {
    setStatus(message);
  }

  function stopCamera() {
    try {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream | null;
        if (stream && typeof stream.getTracks === "function") {
          stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        }
        try {
          videoRef.current.pause();
        } catch {}
        videoRef.current.srcObject = null;
      }

      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
        canvasRef.current = null as any;
      }

      const faceOutline = document.getElementById("face-outline");
      const directionCircle = document.getElementById("direction-circle");
      if (faceOutline) faceOutline.classList.remove("visible");
      if (directionCircle) directionCircle.classList.remove("active");

      updateStatus("Verificación finalizada. Cámara desactivada.");
    } catch (e) {
      console.warn("Error stopping camera:", e);
    }
  }

  async function loadModels() {
    const MODEL_URL = "/models";
    try {
      updateStatus("Loading AI models...");
      
      // Dynamically import face-api.js only on client side
      if (typeof window !== 'undefined' && !faceapiRef.current) {
        const faceapi = await import("face-api.js");
        faceapiRef.current = faceapi;
      }
      
      if (!faceapiRef.current) {
        throw new Error("Face API not available");
      }
      
      const faceapi = faceapiRef.current;
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      updateStatus("Models loaded successfully!");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateStatus("Error loading models: " + errorMsg);
      console.error("Error loading models:", error);
    }
  }

  async function startVideo() {
    try {
      updateStatus("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 500, height: 500 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      updateStatus("Camera access granted!");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateStatus("Error accessing camera: " + errorMsg);
      console.error("Error accessing camera:", error);
      alert(
        "Error accessing camera. Please make sure you have given camera permissions."
      );
    }
  }

  function analyzeFaceOrientation(landmarks: any) {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const jaw = landmarks.getJawOutline();

    const faceCenter = {
      x: (jaw[0].x + jaw[16].x) / 2,
      y: (jaw[0].y + jaw[16].y) / 2,
    };

    const noseX = nose[3].x;
    const noseY = nose[3].y;

    const faceWidth = Math.abs(jaw[16].x - jaw[0].x);
    const faceHeight = Math.abs(
      jaw[8].y - Math.min(leftEye[1].y, rightEye[1].y)
    );

    const noseOffsetX = (noseX - faceCenter.x) / faceWidth;
    const noseOffsetY = (noseY - faceCenter.y) / faceHeight;

    let orientation = "center";

    if (noseOffsetX > 0.35) {
      orientation = "left-strong";
    } else if (noseOffsetX > 0.25) {
      orientation = "left";
    } else if (noseOffsetX > 0.18) {
      orientation = "left-light";
    } else if (noseOffsetX < -0.35) {
      orientation = "right-strong";
    } else if (noseOffsetX < -0.25) {
      orientation = "right";
    } else if (noseOffsetX < -0.18) {
      orientation = "right-light";
    } else if (noseOffsetY < -0.28) {
      orientation = "up-strong";
    } else if (noseOffsetY < -0.2) {
      orientation = "up";
    } else if (noseOffsetY < -0.08) {
      orientation = "up-light";
    } else if (noseOffsetY > 0.4) {
      orientation = "down-strong";
    } else if (noseOffsetY > 0.32) {
      orientation = "down";
    } else if (noseOffsetY > 0.25) {
      orientation = "down-light";
    }

    return orientation;
  }

  function updateProgressVisual() {
    const centerStep = document.getElementById("step-center");
    const leftStep = document.getElementById("step-left");
    const rightStep = document.getElementById("step-right");
    const upStep = document.getElementById("step-up");
    const downStep = document.getElementById("step-down");

    if (!centerStep || !leftStep || !rightStep || !upStep || !downStep) return;

    const steps: Record<string, HTMLElement> = {
      center: centerStep as HTMLElement,
      left: leftStep as HTMLElement,
      right: rightStep as HTMLElement,
      up: upStep as HTMLElement,
      down: downStep as HTMLElement,
    };

    Object.values(steps).forEach((step) => {
      step.classList.remove("active", "completed");
    });

    const state = livenessStateRef.current;

    (Object.keys(steps) as Movement[]).forEach((movement) => {
      if (state[movement]) {
        steps[movement].classList.add("completed");
      }
    });

    if (state.completed) {
      Object.values(steps).forEach((step) => {
        step.classList.add("completed");
      });
    }
  }

  function updateLivenessInstructions() {
    updateProgressVisual();

    const state = livenessStateRef.current;

    if (state.completed) {
      updateStatus("Verificación de vida completada correctamente!");
      return;
    }

    const remainingMovements = requiredMovements.current.filter(
      (movement) => !state[movement]
    );

    if (remainingMovements.length === 0) {
      state.completed = true;
      updateStatus("Verificación de vida completada correctamente!");
      return;
    }

    const movementNames: Record<Movement, string> = {
      center: "centro",
      left: "izquierda",
      right: "derecha",
      up: "arriba",
      down: "abajo",
    };

    const remainingNames = remainingMovements
      .map((m) => movementNames[m])
      .join(", ");
    const instruction = `Pendientes: ${remainingNames}`;

    updateStatus(
      `${instruction} (${state.completedCount}/${totalMovements} completados)`
    );
  }

  function processLivenessDetection(orientation: string) {
    const state = livenessStateRef.current;

    if (state.completed || capturedPhotosRef.current.length >= 5) {
      console.log("🛑 ProcessLiveness: Ya completado o límite alcanzado");
      state.completed = true;
      return;
    }

    let mainOrientation = orientation;
    if (orientation.includes("-")) {
      mainOrientation = orientation.split("-")[0];
    }

    if (orientation === lastOrientationRef.current) {
      orientationStabilityCountRef.current++;
    } else {
      orientationStabilityCountRef.current = 1;
      lastOrientationRef.current = orientation;
    }

    const isValidMovement = requiredMovements.current.includes(
      mainOrientation as Movement
    );
    const isNotCompleted = !state[mainOrientation as Movement];
    const isStableDetection =
      orientationStabilityCountRef.current >= DETECTION_THRESHOLD;

    const alreadyCaptured = capturedPhotosRef.current.some(
      (photo) => photo.step === mainOrientation
    );

    if (
      isValidMovement &&
      isNotCompleted &&
      isStableDetection &&
      !alreadyCaptured
    ) {
      state[mainOrientation as Movement] = true;
      state.completedCount++;

      capturePhoto(mainOrientation);

      if (
        state.completedCount >= totalMovements ||
        capturedPhotosRef.current.length >= 5
      ) {
        state.completed = true;
        console.log("🛑 Liveness completado, deteniendo cámara");
        stopCamera();
      }

      orientationStabilityCountRef.current = 0;
      lastOrientationRef.current = "";

      updateLivenessInstructions();
      updateProgressVisual();
    }
  }

  function createCanvas() {
    if (!videoRef.current || !faceapiRef.current) return;

    const canvas = faceapiRef.current.createCanvasFromMedia(videoRef.current);
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.borderRadius = "50%";
    canvas.style.overflow = "hidden";

    const videoContainer = document.getElementById("video-container");
    if (videoContainer) {
      videoContainer.style.position = "relative";
      videoContainer.appendChild(canvas);
    }

    canvasRef.current = canvas;

    const displaySize = {
      width: videoRef.current.width,
      height: videoRef.current.height,
    };
    displaySizeRef.current = displaySize;
    if (faceapiRef.current) {
      faceapiRef.current.matchDimensions(canvas, displaySize);
    }
  }

  function updateFaceOutline(detection: any) {
    const faceOutline = document.getElementById("face-outline");
    const directionCircle = document.getElementById("direction-circle");
    if (!faceOutline || !detection || !directionCircle || !videoRef.current)
      return;

    const box = detection.detection.box;
    const videoContainer = document.getElementById("video-container");

    const containerSize = Math.min(
      videoContainer?.offsetWidth || 0,
      videoContainer?.offsetHeight || 0
    );
    const videoSize = Math.min(
      videoRef.current.videoWidth,
      videoRef.current.videoHeight
    );
    const scale = containerSize / videoSize;

    const containerCenterX = containerSize / 2;
    const containerCenterY = containerSize / 2;

    const faceWidth = box.width * scale;
    const faceHeight = box.height * scale;
    const faceCenterX =
      containerCenterX - (box.x + box.width / 2 - videoSize / 2) * scale;
    const faceCenterY =
      containerCenterY + (box.y + box.height / 2 - videoSize / 2) * scale;

    const outlineSize = Math.max(faceWidth, faceHeight) * 1.2;

    (faceOutline as HTMLElement).style.left =
      `${faceCenterX - outlineSize / 2}px`;
    (faceOutline as HTMLElement).style.top =
      `${faceCenterY - outlineSize / 2}px`;
    (faceOutline as HTMLElement).style.width = `${outlineSize}px`;
    (faceOutline as HTMLElement).style.height = `${outlineSize}px`;
    faceOutline.classList.add("visible");

    directionCircle.classList.add("active");
  }

  function updateCircleIndicators(currentOrientation: string) {
    const segments: Record<Movement | "center", HTMLElement | null> = {
      center: document.getElementById("segment-center"),
      up: document.getElementById("segment-up"),
      down: document.getElementById("segment-down"),
      left: document.getElementById("segment-left"),
      right: document.getElementById("segment-right"),
    } as any;

    Object.values(segments).forEach((segment) => {
      if (segment) {
        segment.classList.remove("segment-active", "segment-completed");
      }
    });

    const state = livenessStateRef.current;

    (Object.keys(segments) as (Movement | "center")[]).forEach((movement) => {
      if (movement === "center") return;
      const m = movement as Movement;
      if (state[m] && segments[m]) {
        segments[m]?.classList.add("segment-completed");
      }
    });

    let mainOrientation = currentOrientation;
    if (currentOrientation?.includes("-")) {
      mainOrientation = currentOrientation.split("-")[0];
    }

    if (
      segments[mainOrientation as Movement] &&
      !state[mainOrientation as Movement] &&
      !state.completed
    ) {
      segments[mainOrientation as Movement]?.classList.add("segment-active");
    }

    if (state.completed) {
      Object.values(segments).forEach((segment) => {
        if (segment) {
          segment.classList.add("segment-completed");
          segment.classList.remove("segment-active");
        }
      });
    }
  }

  async function detectFaces() {
    const state = livenessStateRef.current;
    if (state.completed) return;

    if (capturedPhotosRef.current.length >= 5) {
      console.log("🛑 PARANDO detección: límite de 5 fotos alcanzado");
      state.completed = true;
      return;
    }

    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended)
      return;
      
    if (!faceapiRef.current) {
      console.warn("Face API not loaded yet");
      return;
    }

    try {
      const detections = await faceapiRef.current
        .detectAllFaces(videoRef.current, new faceapiRef.current.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      if (canvasRef.current) {
        const context = canvasRef.current.getContext("2d");
        if (context) {
          context.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        }
      }

      if (detections.length > 0) {
        const resizedDetections = faceapiRef.current?.resizeResults(
          detections,
          displaySizeRef.current
        );

        const landmarks = resizedDetections[0].landmarks;
        if (landmarks) {
          const orientation = analyzeFaceOrientation(landmarks);
          processLivenessDetection(orientation);
          updateFaceOutline(resizedDetections[0]);
          updateCircleIndicators(orientation);
        }
      } else {
        detectionCountRef.current = 0;
        const faceOutline = document.getElementById("face-outline");
        const directionCircle = document.getElementById("direction-circle");
        if (faceOutline) faceOutline.classList.remove("visible");
        if (directionCircle) directionCircle.classList.remove("active");
        updateStatus("No se detecta rostro - Colócate frente a la cámara");
      }
    } catch (error) {
      console.error("Error during face detection:", error);
    }

    if (
      !livenessStateRef.current.completed &&
      capturedPhotosRef.current.length < 5
    ) {
      rafRef.current = requestAnimationFrame(detectFaces);
    } else {
      console.log("🛑 Deteniendo loop de detección y cámara");
      livenessStateRef.current.completed = true;
      stopCamera();
    }
  }

  function createFileFromVideo(): Promise<File | null> {
    return new Promise((resolve) => {
      if (!videoRef.current) {
        resolve(null);
        return;
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = videoRef.current.videoWidth;
      tempCanvas.height = videoRef.current.videoHeight;
      const tempContext = tempCanvas.getContext("2d");

      if (tempContext) {
        tempContext.drawImage(
          videoRef.current,
          0,
          0,
          tempCanvas.width,
          tempCanvas.height
        );
      }

      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `liveness-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            resolve(file);
          } else {
            resolve(null);
          }
        },
        "image/jpeg",
        0.9
      );
    });
  }

  async function capturePhoto(step: string) {
    try {
      if (capturedPhotosRef.current.length >= 5) {
        console.log(`🚫 Límite alcanzado: 5 fotos máximo. Rechazando ${step}`);
        return;
      }

      const existingPhoto = capturedPhotosRef.current.find(
        (photo) => photo.step === step
      );
      if (existingPhoto) {
        console.log(`🚫 Ya existe foto para paso: ${step}, NO sobrescribir`);
        return;
      }

      const imageFile = await createFileFromVideo();
      if (imageFile) {
        const capturedPhoto: CapturedPhoto = {
          step,
          file: imageFile,
          timestamp: Date.now(),
        };

        capturedPhotosRef.current.push(capturedPhoto);
        setCapturedPhotos([...capturedPhotosRef.current]);

        console.log(
          `✅ Liveness foto capturada: ${step} (${capturedPhotosRef.current.length}/4 máximo)`
        );
      }
    } catch (error) {
      console.error("Error capturing photo:", error);
    }
  }

  function restartVerification() {
    livenessStateRef.current = {
      center: false,
      left: false,
      right: false,
      up: false,
      down: false,
      completed: false,
      completedCount: 0,
      currentInstruction: "Realiza movimientos de cabeza en cualquier orden",
    };

    detectionCountRef.current = 0;
    lastOrientationRef.current = "";
    orientationStabilityCountRef.current = 0;
    capturedPhotosRef.current = [];
    setCapturedPhotos([]);

    updateLivenessInstructions();
    updateProgressVisual();

    const hasStream = Boolean(videoRef.current && videoRef.current.srcObject);
    if (!hasStream) {
      startVideo().then(() => {});
    } else if (
      videoRef.current &&
      !videoRef.current.paused &&
      !videoRef.current.ended
    ) {
      detectFaces();
    }

    updateStatus(
      "Realiza movimientos hacia: centro, izquierda, arriba, derecha, abajo (cualquier orden)"
    );
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadModels();
      if (!mounted) return;
      await startVideo();
    })();

    const handleLoadedMetadata = () => {
      updateStatus("Setting up face detection...");
      createCanvas();

      const onPlay = () => {
        updateStatus(
          "Realiza movimientos hacia: centro, izquierda, arriba, derecha, abajo (cualquier orden)"
        );
        updateLivenessInstructions();
        detectFaces();
      };

      if (videoRef.current) {
        videoRef.current.addEventListener("play", onPlay);
      }

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener("play", onPlay);
        }
      };
    };

    if (videoRef.current) {
      videoRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
    }

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      if (videoRef.current) {
        videoRef.current.removeEventListener(
          "loadedmetadata",
          handleLoadedMetadata
        );
        const stream = videoRef.current.srcObject as MediaStream | null;
        if (stream && typeof stream.getTracks === "function") {
          stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        }
      }

      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
    };
  }, []);

  return {
    videoRef,
    containerRef,
    status,
    restartVerification,
    capturedPhotos,
    isCompleted: livenessStateRef.current.completed,
  };
}
