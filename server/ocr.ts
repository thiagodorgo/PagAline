import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { TextractClient, AnalyzeExpenseCommand, type Block, type ExpenseDocument, type ExpenseField } from "@aws-sdk/client-textract";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PDFParse } from "pdf-parse";

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

async function streamToBuffer(stream: unknown) {
  if (!stream) return Buffer.alloc(0);

  if (typeof stream === "object" && stream !== null && "transformToByteArray" in stream && typeof stream.transformToByteArray === "function") {
    const bytes = await stream.transformToByteArray();
    return Buffer.from(bytes);
  }

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const readable = stream as NodeJS.ReadableStream;

    readable.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

async function extractPdfTextFromS3(bucketName: string, key: string) {
  if (!key.toLowerCase().endsWith(".pdf")) return "";

  try {
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    const pdfBuffer = await streamToBuffer(response.Body);
    if (!pdfBuffer.length) return "";

    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    await parser.destroy();
    return normalizeMultilineText(result.text);
  } catch (error) {
    console.warn("[ocr] pdf text fallback failed", error);
    return "";
  }
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

function normalizeMultilineText(value?: string) {
  if (!value) return "";

  return value
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .split("\n")
    .map((line) => normalizeText(line))
    .filter((line): line is string => !!line)
    .join("\n");
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

function fieldLabel(field?: ExpenseField) {
  return normalizeText(field?.LabelDetection?.Text);
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

function findFieldByLabel(summaryFields: ExpenseField[] | undefined, ...patterns: RegExp[]) {
  if (!summaryFields?.length) return undefined;

  for (const field of summaryFields) {
    const label = fieldLabel(field)?.toLowerCase();
    const value = fieldValue(field);
    if (!label || !value) continue;

    if (patterns.some((pattern) => pattern.test(label))) {
      return value;
    }
  }

  return undefined;
}

function cleanEntityName(value?: string) {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;

  return normalized
    .replace(/\s*\/\s*endere[cç]o.*/i, "")
    .replace(/\s+\/\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*/i, "")
    .replace(/\s+\/\s*\d{11,14}.*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function matchRawTextValue(rawText: string, ...patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    const value = normalizeText(match?.[1]);
    if (value) return value;
  }

  return undefined;
}

function getTextLines(rawText: string) {
  return normalizeMultilineText(rawText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function findLineValue(rawText: string, labels: RegExp[], inlineValuePattern?: RegExp) {
  const lines = getTextLines(rawText);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!labels.some((pattern) => pattern.test(line))) continue;

    if (inlineValuePattern) {
      const inlineMatch = line.match(inlineValuePattern);
      const inlineValue = normalizeText(inlineMatch?.[1]);
      if (inlineValue) return inlineValue;
    }

    for (let offset = 1; offset <= 2; offset += 1) {
      const candidate = normalizeText(lines[index + offset]);
      if (candidate) return candidate;
    }
  }

  return undefined;
}

function findValueAfterLabel(rawText: string, labels: RegExp[], valuePattern: RegExp) {
  const lines = getTextLines(rawText);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!labels.some((pattern) => pattern.test(line))) continue;

    const inlineMatch = line.match(valuePattern);
    const inlineValue = normalizeText(inlineMatch?.[1] ?? inlineMatch?.[0]);
    if (inlineValue) return inlineValue;

    for (let offset = 1; offset <= 4; offset += 1) {
      const candidate = lines[index + offset];
      if (!candidate) continue;

      const candidateMatch = candidate.match(valuePattern);
      const candidateValue = normalizeText(candidateMatch?.[1] ?? candidateMatch?.[0]);
      if (candidateValue) return candidateValue;
    }
  }

  return undefined;
}

function extractBoletoDescription(rawText: string) {
  return cleanEntityName(
    findLineValue(rawText, [
      /nome do benefici[aá]rio/i,
      /benefici[aá]rio/i,
      /cedente/i,
      /fornecedor/i,
      /recebedor/i,
    ], /:\s*(.+)$/i) ??
      matchRawTextValue(
        rawText,
        /benefici[aá]rio:\s*(.+)/i,
        /nome do benefici[aá]rio[^\n:]*:\s*(.+)/i,
        /nome do benefici[aá]rio[^\n]*\n([^\n]+)/i,
        /nome do benefici[aá]rio.*?:\s*(.+)/i,
        /cedente:\s*(.+)/i,
        /fornecedor:\s*(.+)/i,
        /recebedor:\s*(.+)/i,
      ),
  );
}

function extractBoletoAmount(rawText: string) {
  return findValueAfterLabel(rawText, [
    /valor do documento/i,
    /valor cobrado/i,
    /valor pago/i,
    /^total$/i,
  ], /(?:R\$\s*)?([0-9][0-9.,]*)$/i) ??
    matchRawTextValue(
      rawText,
      /valor do documento:\s*([0-9.,]+)/i,
      /valor do documento:\s*R?\$?\s*([0-9.,]+)/i,
      /valor do documento[^\n]*\n([0-9.,]+)/i,
      /valor do documento[^\n]*\nR?\$?\s*([0-9.,]+)/i,
      /valor cobrado:\s*([0-9.,]+)/i,
      /valor pago:\s*([0-9.,]+)/i,
      /total:\s*([0-9.,]+)/i,
    );
}

function extractBoletoDueDate(rawText: string) {
  return findValueAfterLabel(rawText, [
    /data de vencimento/i,
    /^vencimento$/i,
  ], /([0-9]{2}[\/.-][0-9]{2}[\/.-][0-9]{2,4})/i) ??
    matchRawTextValue(
      rawText,
      /data de vencimento:\s*([0-9]{2}[\/.-][0-9]{2}[\/.-][0-9]{2,4})/i,
      /data de vencimento[^\n]*\n([0-9]{2}[\/.-][0-9]{2}[\/.-][0-9]{2,4})/i,
      /vencimento:\s*([0-9]{2}[\/.-][0-9]{2}[\/.-][0-9]{2,4})/i,
    );
}

function buildRawTextFromBlocks(blocks: Block[] | undefined) {
  if (!blocks?.length) return "";

  const lines = blocks
    .filter((block) => block.BlockType === "LINE")
    .map((block) => normalizeText(block.Text))
    .filter((line): line is string => !!line);

  return lines.join("\n");
}

function buildRawText(expenseDocument?: ExpenseDocument) {
  if (!expenseDocument) return "";

  const blockText = buildRawTextFromBlocks(expenseDocument.Blocks);
  if (blockText) {
    return blockText;
  }

  const lines = new Set<string>();
  for (const field of expenseDocument.SummaryFields ?? []) {
    const type = normalizeText(field.Type?.Text);
    const label = fieldLabel(field);
    const value = fieldValue(field);

    if (label && value) lines.add(`${label}: ${value}`);
    if (type && value) lines.add(`${type}: ${value}`);
  }

  return Array.from(lines).join("\n");
}

function extractSuggestion(expenseDocument?: ExpenseDocument, sourceUri?: string, key?: string, fallbackRawText?: string): OcrBillSuggestion {
  const summaryFields = expenseDocument?.SummaryFields ?? [];
  const rawText = [buildRawText(expenseDocument), fallbackRawText]
    .filter((value): value is string => !!value)
    .join("\n");

  const summaryDescription =
    cleanEntityName(findFieldByLabel(summaryFields, /benefici[aá]rio/, /fornecedor/, /recebedor/, /cedente/)) ??
    cleanEntityName(findFieldValue(summaryFields, "VENDOR_NAME", "RECEIVER_NAME", "SUPPLIER_NAME")) ??
    cleanEntityName(findFieldByLabel(summaryFields, /evento/, /descricao/, /descri[cç][aã]o/)) ??
    findFieldValue(summaryFields, "VENDOR_NAME", "RECEIVER_NAME", "SUPPLIER_NAME") ??
    findFieldValue(summaryFields, "INVOICE_RECEIPT_ID") ??
    "Conta OCR";
  const summaryAmountText =
    findFieldByLabel(summaryFields, /valor do documento/, /valor cobrado/, /valor pago/, /^valor$/) ??
    findFieldValue(summaryFields, "TOTAL", "AMOUNT_DUE", "BALANCE_DUE", "NET_AMOUNT", "SUBTOTAL") ?? "";
  const summaryDueDateText =
    findFieldByLabel(summaryFields, /data de vencimento/, /^vencimento$/, /vencimento/) ??
    findFieldValue(summaryFields, "DUE_DATE") ??
    findFieldValue(summaryFields, "INVOICE_RECEIPT_DATE");

  const rawDescription = rawText ? extractBoletoDescription(rawText) : undefined;
  const rawAmountText = rawText ? extractBoletoAmount(rawText) : undefined;
  const rawDueDateText = rawText ? extractBoletoDueDate(rawText) : undefined;

  const normalizedDescription =
    summaryDescription === "Conta OCR"
      ? rawDescription ?? summaryDescription
      : summaryDescription;
  const amount = parseAmount(summaryAmountText) ?? parseAmount(rawAmountText);
  const dueDate = parseDate(summaryDueDateText) ?? parseDate(rawDueDateText);

  const suggestion = {
    description: normalizedDescription,
    amount,
    dueDate,
    category: inferCategory(normalizedDescription),
    notes: rawText || undefined,
    imageUrl: sourceUri ?? "",
    sourceUri: sourceUri ?? "",
    key: key ?? "",
    rawText,
  } satisfies OcrBillSuggestion;

  console.info("[ocr] parsed suggestion", JSON.stringify({
    key: suggestion.key,
    description: suggestion.description,
    amount: suggestion.amount,
    dueDate: suggestion.dueDate,
    category: suggestion.category,
    summaryFieldCount: summaryFields.length,
  }));

  return suggestion;
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
  const fallbackRawText = await extractPdfTextFromS3(bucketName, key);
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

  return extractSuggestion(expenseDocument, `s3://${bucketName}/${key}`, key, fallbackRawText);
}
