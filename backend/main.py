import os
os.environ.setdefault("INSIGHTFACE_HOME", "/opt/.insightface")
os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp")
os.environ.setdefault("OMP_NUM_THREADS", "2")

import logging
from pathlib import Path
import numpy as np
from PIL import Image
import cv2
import boto3
import io
from insightface.app import FaceAnalysis
from insightface import model_zoo

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def load_bgr_from_s3(s3_url: str):
    if s3_url.startswith('s3://'):
        parts = s3_url[5:].split('/', 1)
        bucket = parts[0]
        key = parts[1] if len(parts) > 1 else ''
    elif 'amazonaws.com' in s3_url:
        from urllib.parse import urlparse
        parsed = urlparse(s3_url)
        bucket = parsed.hostname.split('.')[0]
        key = parsed.path.lstrip('/')
    else:
        raise ValueError(f"Formato de URL S3 no válido: {s3_url}")
    
    s3_client = boto3.client('s3')
    response = s3_client.get_object(Bucket=bucket, Key=key)
    image_data = response['Body'].read()
    
    image = Image.open(io.BytesIO(image_data)).convert("RGB")
    arr = np.asarray(image, dtype=np.uint8)
    return arr[:, :, ::-1]

def load_bgr(p: Path):
    arr = np.asarray(Image.open(p).convert("RGB"), dtype=np.uint8)
    return arr[:, :, ::-1]

def embed_best(app: FaceAnalysis, img_bgr: np.ndarray):
    faces = app.get(img_bgr)
    if not faces: return None, []
    faces.sort(key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
    return faces[0].normed_embedding, faces

def cosine(a, b): return float(np.dot(a, b))

_app = None
def _get_app():
    global _app
    if _app is not None: return _app

    root = os.environ.get("INSIGHTFACE_HOME", "/opt/.insightface")
    logging.info("Init InsightFace (det=buffalo_l SCRFD-10GF, rec=antelopev2 glintr100, CPU)…")

    app = FaceAnalysis(name="buffalo_l", root=root, allowed_modules=['detection','recognition'])
    app.prepare(ctx_id=-1, det_size=(800,800), det_thresh=0.3)

    glintr = os.path.join(root, "models", "antelopev2", "glintr100.onnx")
    rec = model_zoo.get_model(glintr)
    rec.prepare(ctx_id=-1)
    app.models['recognition'] = rec

    _app = app
    return _app

def verify_pair(img1_url: str, img2_url: str):
    try:
        i1 = load_bgr_from_s3(img1_url)
        i2 = load_bgr_from_s3(img2_url)
        
        app = _get_app()

        e1, f1 = embed_best(app, i1)
        e2, f2 = embed_best(app, i2)
        logging.info(f"Detecciones: img1={len(f1)}  img2={len(f2)}")
        
        if not f1 or not f2:
            return {"ok": False, "msg": "no se detectó rostro en alguna imagen"}

        sim = cosine(e1, e2)
        thr = float(os.environ.get("COSINE_MIN_ACCEPT", "0.70"))
        return {
            "verified": bool(sim >= thr),
            "similarity": sim,
            "cosine_min_accept": thr,
            "pack_detector": "buffalo_l (SCRFD-10GF)",
            "pack_recognizer": "antelopev2 (glintr100)",
            "note": "InsightFace/ONNX híbrido",
            "img1_url": img1_url,
            "img2_url": img2_url
        }
    except Exception as e:
        logging.error(f"Error procesando imágenes: {str(e)}")
        return {"ok": False, "error": str(e)}

def lambda_handler(event, context):
    try:
        img1_url = event.get('img1_url')
        img2_url = event.get('img2_url')
        
        if not img1_url or not img2_url:
            return {
                "statusCode": 400,
                "body": {
                    "ok": False,
                    "error": "Se requieren img1_url y img2_url en el event"
                }
            }
        
        result = verify_pair(img1_url, img2_url)
        
        return {
            "statusCode": 200,
            "body": result
        }
        
    except Exception as e:
        logging.error(f"Error en lambda_handler: {str(e)}")
        return {
            "statusCode": 500,
            "body": {
                "ok": False,
                "error": f"Error interno: {str(e)}"
            }
        }