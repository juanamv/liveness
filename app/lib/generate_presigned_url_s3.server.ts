import { AwsClient } from "aws4fetch";

type S3Config = {
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

function getS3Config(env: any): S3Config {
  const region = String(env.S3_REGION || "").trim();
  const bucketName = String(env.S3_BUCKET_NAME || "").trim();
  const accessKeyId = String(env.S3_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(env.S3_SECRET_ACCESS_KEY || "").trim();
  const sessionToken = String(env.AWS_SESSION_TOKEN || "").trim() || undefined;
  if (!region || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing required S3 environment variables");
  }
  return { region, bucketName, accessKeyId, secretAccessKey, sessionToken };
}

async function presignPutUrl(cfg: S3Config, params: {
  key: string;
  expiresIn?: number;
  contentType?: string;
}) {
  const { key, expiresIn = 360, contentType = "image/jpeg" } = params;

  const aws = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    sessionToken: cfg.sessionToken,
    region: cfg.region,
    service: "s3",
  });

  const baseUrl = `https://${cfg.bucketName}.s3.${cfg.region}.amazonaws.com/${encodeURI(key)}`;
  const req = await aws.sign(baseUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    aws: { signQuery: true },
  });
  return req.url;
}

export const generatePresignedUrls = async (email: string, env?: any) => {
  const cfg = getS3Config(env ?? {});
  const out: Array<{
    url: string;
    step: number | string;
    type: "face" | "document";
  }> = [];

  for (let i = 0; i < 5; i++) {
    out.push({
      url: await presignPutUrl(cfg, { key: `uploads/${email}-part${i + 1}.jpg` }),
      step: i + 1,
      type: "face",
    });
  }

  out.push({
    url: await presignPutUrl(cfg, { key: `uploads/${email}-document_front.jpg` }),
    step: "document_front",
    type: "document",
  });
  out.push({
    url: await presignPutUrl(cfg, { key: `uploads/${email}-document_back.jpg` }),
    step: "document_back",
    type: "document",
  });

  return out;
};
