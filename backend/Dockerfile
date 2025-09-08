FROM python:3.11-slim-bookworm AS builder

ENV PIP_NO_CACHE_DIR=1 \
    INSIGHTFACE_HOME=/opt/.insightface

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip setuptools wheel
RUN pip install --prefix=/install \
      "numpy<2" insightface==0.7.3 onnxruntime==1.17.1 \
      opencv-python-headless==4.10.0.84 Pillow==10.0.1 boto3

RUN mkdir -p "/opt/.insightface" \
 && PYTHONPATH=/install/lib/python3.11/site-packages python - <<'PY'
import os, sys, glob, pathlib, zipfile, shutil
sys.path.append("/install/lib/python3.11/site-packages")
from insightface.utils.storage import ensure_available

ROOT = os.environ.get("INSIGHTFACE_HOME","/opt/.insightface")
MODELS = pathlib.Path(ROOT) / "models"
MODELS.mkdir(parents=True, exist_ok=True)

def ensure_pack(pack: str):
    # 1) dispara descarga (deja pack.zip en ROOT/models)
    ensure_available('models', pack, root=ROOT)

    tdir = MODELS / pack
    zpath = MODELS / f"{pack}.zip"
    tdir.mkdir(parents=True, exist_ok=True)

    # 2) si no hay .onnx directos, intenta descomprimir zpath
    has_onnx = list(tdir.glob("*.onnx"))
    if not has_onnx and zpath.exists():
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(tdir)

    # 3) aplanar: mueve .onnx de subcarpetas a tdir
    for p in tdir.rglob("*.onnx"):
        if p.parent != tdir:
            dest = tdir / p.name
            if not dest.exists():
                shutil.move(str(p), str(dest))

    # 4) limpiar subcarpetas vacías
    for sub in list(tdir.glob("**/*")):
        if sub.is_dir() and not any(sub.iterdir()):
            sub.rmdir()

    # 5) validar
    onnx = sorted([str(x) for x in tdir.glob("*.onnx")])
    print(f"[{pack}] ONNX:", onnx)
    if not onnx:
        raise SystemExit(f"ERROR: no .onnx found for {pack} in {tdir}")

for pack in ("buffalo_l", "antelopev2"):
    ensure_pack(pack)

need = [
    MODELS / "buffalo_l" / "det_10g.onnx",
    MODELS / "antelopev2" / "glintr100.onnx",  # encoder R100
]
missing = [str(p) for p in need if not p.exists()]
print("Revisando claves:\n - " + "\n - ".join(map(str, need)))
if missing:
    raise SystemExit("Faltan: " + ", ".join(missing))
print("OK: modelos listos en", ROOT)
PY

FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    OPENCV_LOG_LEVEL=ERROR \
    HOME=/opt \
    INSIGHTFACE_HOME=/opt/.insightface \
    OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2 JOBLIB_TEMP_FOLDER=/tmp \
    MPLCONFIGDIR=/tmp/matplotlib XDG_CACHE_HOME=/tmp

COPY --from=builder /install /usr/local
COPY --from=builder /opt/.insightface /opt/.insightface

RUN python -m pip install --no-cache-dir awslambdaric

WORKDIR /app
COPY main.py /app/main.py
CMD ["python","-m","awslambdaric","main.lambda_handler"]
