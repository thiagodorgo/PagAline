import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { TextractClient, AnalyzeExpenseCommand, type ExpenseDocument, type ExpenseField } from "@aws-sdk/client-textract";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const SUPPORTED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
]);

const MAX_SYNC_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface OcrUploadRequest {
  fileName: string;
  contentType: string;
  fileSize?: number;
}

export interface OcrUploadTarget {
  key: string;
  uploadUrl: string;
  sourceUri: string;
  expiresIn: number;
}

export interface OcrBillSuggestion {
  description?: string;
  amount?: number;
  dueDate?: string;
  category?: string;
  notes?: string;
  imageUrl: string;
  sourceUri: string;
  key: string;
  rawText: string;
}

function getOcrBucketName() {
  const bucketName = process.env.OCR_BUCKET_NAME;
  if (!bucketName) {
    const error = new Error("OCR_BUCKET_NAME must be set to enable OCR.");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }
  return bucketName;
}

function getAwsRegion() {
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
}

function getS3Client() {
  return new S3Client({ region: getAwsRegion() });
}

function getTextractClient() {
  return new TextractClient({ region: getAwsRegion() });
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "document";
}

function normalizeContentType(contentType: string) {
  return contentType.trim().toLowerCase();
}

function buildObjectKey(fileName: string) {
  const safeFileName = sanitizeFileName(fileName);
  const datePrefix = new Date().toISOString().slice(0, 10);
  return `ocr/${datePrefix}/${randomUUID()}-${safeFileName}`;
}

function parseAmount(value?: string) {
  if (!value) return undefined;

  const normalized = value
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;

  const trimmed = value.trim();
  const brMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (brMatch) {
    const day = Number.parseInt(brMatch[1], 10);
    const month = Number.parseInt(brMatch[2], 10);
    const rawYear = Number.parseInt(brMatch[3], 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeText(value?: string) {
  return value?.trim().replace(/\s+/g, " ");
}

function inferCategory(description?: string) {
  const text = description?.toLowerCase() ?? "";
  if (!text) return "Outros";
  if (/(energia|eletric|luz|água|agua|gás|gas|condom|aluguel|internet|telefone|celular)/.test(text)) return "Casa";
  if (/(uber|99 |taxi|combust|transporte|metrô|metro|ônibus|onibus|pedágio|pedagio)/.test(text)) return "Transporte";
  if (/(escola|faculdade|curso|mensalidade|educa)/.test(text)) return "Educação";
  if (/(farm|hospital|consulta|cl[ií]nica|clinica|sa[úu]de|plano)/.test(text)) return "Saúde";
  if (/(iptu|ipva|imposto|darf|tributo|receita)/.test(text)) return "Impostos";
  return "Outros";
}

function fieldValue(field?: ExpenseField) {
  return normalizeText(field?.ValueDetection?.Text);
}

function findFieldValue(summaryFields: ExpenseField[] | undefined, ...types: string[]) {
  if (!summaryFields?.length) return undefined;

  const upperTypes = new Set(types.map((type) => type.toUpperCase()));
  for (const field of summaryFields) {
    const fieldType = field.Type?.Text?.toUpperCase();
    if (fieldType && upperTypes.has(fieldType)) {
      const value = fieldValue(field);
      if (value) return value;
    }
  }

  return undefined;
}

function buildRawText(expenseDocument?: ExpenseDocument) {
  if (!expenseDocument) return "";

  const lines = new Set<string>();
  for (const field of expenseDocument.SummaryFields ?? []) {
    const type = normalizeText(field.Type?.Text);
    const value = fieldValue(field);
    if (type && value) lines.add(`${type}: ${value}`);
  }

  return Array.from(lines).join("\n");
}

function extractSuggestion(expenseDocument?: ExpenseDocument, sourceUri?: string, key?: string): OcrBillSuggestion {
  const summaryFields = expenseDocument?.SummaryFields ?? [];
  const description =
    findFieldValue(summaryFields, "VENDOR_NAME", "RECEIVER_NAME", "SUPPLIER_NAME") ??
    findFieldValue(summaryFields, "INVOICE_RECEIPT_ID") ??
    "Conta OCR";
  const amountText =
    findFieldValue(summaryFields, "TOTAL", "AMOUNT_DUE", "BALANCE_DUE", "NET_AMOUNT", "SUBTOTAL") ?? "";
  const dueDateText =
    findFieldValue(summaryFields, "DUE_DATE") ??
    findFieldValue(summaryFields, "INVOICE_RECEIPT_DATE");
  const rawText = buildRawText(expenseDocument);

  return {
    description,
    amount: parseAmount(amountText),
    dueDate: parseDate(dueDateText),
    category: inferCategory(description),
    notes: rawText || undefined,
    imageUrl: sourceUri ?? "",
    sourceUri: sourceUri ?? "",
    key: key ?? "",
    rawText,
  };
}

export function validateOcrUpload(input: OcrUploadRequest) {
  const contentType = normalizeContentType(input.contentType);
  if (!SUPPORTED_CONTENT_TYPES.has(contentType)) {
    const error = new Error("Tipo de arquivo não suportado. Envie JPG, PNG, TIFF ou PDF.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  if (input.fileSize && input.fileSize > MAX_SYNC_FILE_SIZE_BYTES) {
    const error = new Error("Arquivo acima do limite de 10 MB para o OCR síncrono.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  return { contentType };
}

export async function createOcrUploadTarget(input: OcrUploadRequest): Promise<OcrUploadTarget> {
  const { contentType } = validateOcrUpload(input);
  const bucketName = getOcrBucketName();
  const key = buildObjectKey(input.fileName);
  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  );

  return {
    key,
    uploadUrl,
    sourceUri: `s3://${bucketName}/${key}`,
    expiresIn: 300,
  };
}

export async function extractBillFromUploadedDocument(key: string) {
  const bucketName = getOcrBucketName();
  const response = await getTextractClient().send(
    new AnalyzeExpenseCommand({
      Document: {
        S3Object: {
          Bucket: bucketName,
          Name: key,
        },
      },
    }),
  );

  const expenseDocument = response.ExpenseDocuments?.[0];
  if (!expenseDocument) {
    const error = new Error("O Textract não encontrou dados suficientes no documento enviado.");
    (error as Error & { status?: number }).status = 422;
    throw error;
  }

  return extractSuggestion(expenseDocument, `s3://${bucketName}/${key}`, key);
}

