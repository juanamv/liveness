import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Camera, CheckCircle } from "lucide-react";
import FaceLiveness from "./liveness/FaceLiveness";

type Step = {
  id: number;
  title: string;
  description: string;
  completed: boolean;
};

type DocumentVerificationFormProps = {
  presignedUrls?: Array<{
    url: string;
    step: number | string;
    type: "face" | "document";
  }>;
  email?: string;
};

type CapturedImage = {
  id: string;
  type: "document_front" | "document_back" | "liveness";
  step?: string;
  file: File;
  timestamp: number;
};

export default function DocumentVerificationForm({
  presignedUrls = [],
  email = "",
}: DocumentVerificationFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>("");

  const getDocumentFront = () =>
    capturedImages.find((img) => img.type === "document_front");
  const getDocumentBack = () =>
    capturedImages.find((img) => img.type === "document_back");
  const getLivenessPhotos = () =>
    capturedImages.filter((img) => img.type === "liveness");

  React.useEffect(() => {}, [capturedImages]);

  const steps: Step[] = [
    {
      id: 1,
      title: "Subir Documento - Anverso",
      description: "Sube la parte frontal de tu documento de identidad",
      completed: !!getDocumentFront(),
    },
    {
      id: 2,
      title: "Subir Documento - Reverso",
      description: "Sube la parte trasera de tu documento de identidad",
      completed: !!getDocumentBack(),
    },
    {
      id: 3,
      title: "Verificación de Vida",
      description: "Completa la verificación facial para finalizar el proceso",
      completed: getLivenessPhotos().length > 0,
    },
    {
      id: 4,
      title: "Resumen Final",
      description: "Revisa todos los archivos capturados antes de finalizar",
      completed: isComplete,
    },
  ];

  const currentProgress = (currentStep / steps.length) * 100;

  const addImage = (file: File, type: CapturedImage["type"], step?: string) => {
    const newImage: CapturedImage = {
      id: `${type}_${Date.now()}`,
      type,
      step,
      file,
      timestamp: Date.now(),
    };

    setCapturedImages((prev) => {
      if (type !== "liveness") {
        const filtered = prev.filter((img) => img.type !== type);
        return [...filtered, newImage];
      }

      const livenessPhotos = prev.filter((img) => img.type === "liveness");
      if (livenessPhotos.length >= 5) return prev;
      if (step && livenessPhotos.some((img) => img.step === step)) return prev;
      return [...prev, newImage];
    });

    console.log(
      `Imagen agregada: ${type} (Total: ${capturedImages.length + 1})`
    );
  };

  const removeImage = (imageId: string) => {
    setCapturedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const handleFileUpload = (file: File | null, type: "front" | "back") => {
    if (file) {
      const imageType = type === "front" ? "document_front" : "document_back";
      addImage(file, imageType);
      if (type === "front" && currentStep === 1) {
        setCurrentStep(2);
      } else if (type === "back" && currentStep === 2) {
        setCurrentStep(3);
      }
    } else {
      const imageType = type === "front" ? "document_front" : "document_back";
      const existingImage = capturedImages.find(
        (img) => img.type === imageType
      );
      if (existingImage) {
        removeImage(existingImage.id);
      }
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!getDocumentFront();
      case 2:
        return !!getDocumentBack();
      case 3:
        return getLivenessPhotos().length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleFinish = () => {
    void (async () => {
      try {
        setIsUploading(true);
        setUploadMessage("Subiendo archivos a S3...");

        const faceUrls = presignedUrls.filter((u) => u.type === "face");
        const docFrontUrl = presignedUrls.find(
          (u) => u.type === "document" && u.step === "document_front"
        );
        const docBackUrl = presignedUrls.find(
          (u) => u.type === "document" && u.step === "document_back"
        );

        const livenessPhotos = getLivenessPhotos().slice(0, 5);
        const livenessPairs = livenessPhotos
          .map((photo, idx) => ({ file: photo.file, url: faceUrls[idx]?.url }))
          .filter((p) => Boolean(p.url)) as { file: File; url: string }[];

        const uploadPut = (url: string, file: File) =>
          fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: file,
          });

        const tasks: Array<Promise<Response>> = [];

        livenessPairs.forEach(({ url, file }, i) => {
          setUploadMessage(
            `Subiendo rostro ${i + 1}/${livenessPairs.length}...`
          );
          tasks.push(uploadPut(url, file));
        });

        const docFront = getDocumentFront();
        const docBack = getDocumentBack();
        if (docFront && docFrontUrl)
          tasks.push(uploadPut(docFrontUrl.url, docFront.file));
        if (docBack && docBackUrl)
          tasks.push(uploadPut(docBackUrl.url, docBack.file));

        const results = await Promise.allSettled(tasks);
        const failed = results.filter(
          (r) =>
            r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
        );

        if (failed.length > 0) {
          setUploadMessage(
            "Ocurrió un error al subir los archivos. Inténtalo más tarde."
          );
          setIsComplete(false);
        } else {
          try {
            const res = await fetch("/liveness", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ intent: "complete" }),
            });
            if (!res.ok) throw new Error(`Bad status ${res.status}`);
            setUploadMessage(
              "La información fue cargada y será validada en unos minutos."
            );
            setIsComplete(true);
          } catch (err) {
            setUploadMessage(
              "La información fue cargada. Nota: no se pudo marcar el estado, inténtalo más tarde."
            );
            setIsComplete(true);
          }
        }
      } catch (e) {
        setUploadMessage(
          "Ocurrió un error al subir los archivos. Inténtalo más tarde."
        );
      } finally {
        setIsUploading(false);
      }
    })();
  };

  React.useEffect(() => {
    if (currentStep === 4 && !isComplete && !isUploading && !hasUploaded) {
      setHasUploaded(true);
      handleFinish();
    }
  }, [currentStep, isComplete, isUploading, hasUploaded]);

  const handleLivenessComplete = () => {
    setCurrentStep(4);
  };

  const handleLivenessPhotos = (
    photos: Array<{ step: string; file: File; timestamp: number }>
  ) => {
    setCapturedImages((prev) => {
      const existing = prev.filter((img) => img.type === "liveness");
      const existingSteps = new Set(existing.map((img) => img.step));

      const remainingSlots = Math.max(0, 5 - existing.length);
      const toAdd = photos
        .filter((p) => !existingSteps.has(p.step))
        .slice(0, remainingSlots)
        .map((p) => ({
          id: `liveness_${p.step}_${p.timestamp}`,
          type: "liveness" as const,
          step: p.step,
          file: p.file,
          timestamp: p.timestamp,
        }));

      if (toAdd.length === 0) return prev;

      const next = [...prev, ...toAdd];
      return next;
    });
  };

  const renderFileUpload = (
    type: "front" | "back",
    currentFile: File | null,
    onFileChange: (file: File | null) => void
  ) => (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor={`${type}-upload`}
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {currentFile ? (
              <>
                <CheckCircle className="w-10 h-10 mb-3 text-green-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">{currentFile.name}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Archivo cargado correctamente
                </p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Haz clic para subir</span> o
                  arrastra el archivo aquí
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG o PDF (MAX. 10MB)
                </p>
              </>
            )}
          </div>
          <Input
            id={`${type}-upload`}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              onFileChange(file);
            }}
          />
        </label>
      </div>
      {currentFile && (
        <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
          <FileText className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-800 flex-1">
            {currentFile.name}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFileChange(null)}
          >
            Remover
          </Button>
        </div>
      )}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <h3 className="text-lg font-semibold mb-2">
                Documento de Identidad - Anverso
              </h3>
              <p className="text-gray-600 mb-6">
                Por favor, sube una imagen clara de la parte frontal de tu
                documento de identidad (cédula, pasaporte, etc.)
              </p>
            </div>
            {renderFileUpload(
              "front",
              getDocumentFront()?.file || null,
              (file) => handleFileUpload(file, "front")
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <h3 className="text-lg font-semibold mb-2">
                Documento de Identidad - Reverso
              </h3>
              <p className="text-gray-600 mb-6">
                Por favor, sube una imagen clara de la parte trasera de tu
                documento de identidad
              </p>
            </div>
            {renderFileUpload("back", getDocumentBack()?.file || null, (file) =>
              handleFileUpload(file, "back")
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Camera className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">
                Verificación de Vida
              </h3>
              <p className="text-gray-600">
                Ahora completaremos la verificación facial. Sigue las
                instrucciones en pantalla para mover tu rostro en las
                direcciones indicadas.
              </p>
            </div>
            <FaceLiveness
              presignedUrls={presignedUrls}
              email={email}
              onPhotosCapture={handleLivenessPhotos}
              onComplete={handleLivenessComplete}
            />
            {getLivenessPhotos().length > 0 && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-800 font-medium">
                    Verificación de vida completada
                  </span>
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">
                Resumen de Verificación
              </h3>
              <p className="text-gray-600">
                Revisa todos los archivos capturados antes de finalizar el
                proceso.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Documentos de Identidad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Anverso</p>
                      <p className="text-sm text-gray-600">
                        {getDocumentFront()?.file.name || "No disponible"}
                      </p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                  </div>
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Reverso</p>
                      <p className="text-sm text-gray-600">
                        {getDocumentBack()?.file.name || "No disponible"}
                      </p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Verificación de Vida
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <Camera className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium">Verificación</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-green-800 font-medium">
                  Todos los archivos han sido capturados exitosamente. Presiona
                  "Finalizar" para completar la verificación.
                </p>
              </div>
              <div className="text-sm text-green-700">
                {capturedImages.length > 8 && (
                  <div className="text-orange-600 text-xs mt-1">
                    Se capturaron más imágenes de las esperadas
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Verificación de Identidad</CardTitle>
          <CardDescription>
            Completa el proceso de verificación subiendo tu documento de
            identidad y realizando la verificación facial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                Paso {currentStep} de {steps.length}
              </span>
              <span>{Math.round(currentProgress)}% completado</span>
            </div>
            <Progress value={currentProgress} className="h-2" />

            <div className="flex justify-between">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center space-y-2 ${
                    step.id <= currentStep ? "text-blue-600" : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      step.completed
                        ? "bg-green-500 text-white"
                        : step.id === currentStep
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className="text-xs text-center max-w-20">
                    {step.title.split(" - ")[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep - 1]?.title}</CardTitle>
          <CardDescription>
            {steps[currentStep - 1]?.description}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {currentStep < 4 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                Anterior
              </Button>
              <Button onClick={handleNext} disabled={!canProceed()}>
                {currentStep === 3 ? "Continuar" : "Siguiente"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && !isComplete && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isUploading}
              >
                Anterior
              </Button>
              <Button
                onClick={handleFinish}
                className="bg-green-600 hover:bg-green-700"
                disabled={isUploading}
              >
                {isUploading ? "Subiendo…" : "Finalizar Verificación"}
              </Button>
            </div>
            {uploadMessage && (
              <div className="text-sm text-gray-600 mt-3">{uploadMessage}</div>
            )}
          </CardContent>
        </Card>
      )}

      {isComplete && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
              <h3 className="text-xl font-semibold text-green-800">
                Información cargada para validación
              </h3>
              <p className="text-gray-600">
                Tus documentos y fotos se enviaron correctamente y serán
                revisados en unos minutos. Te notificaremos cuando la validación
                esté lista.
              </p>
              <Button
                onClick={() => (window.location.href = "/")}
                className="mt-4"
              >
                Ir al Inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isUploading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full text-center space-y-4">
            <div className="mx-auto w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <h4 className="font-semibold">Subiendo archivos…</h4>
            <p className="text-sm text-gray-600">
              Este proceso puede tardar algunos minutos. Puedes regresar en unos
              minutos mientras terminamos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
