import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Ocr } from '@jcesarmobile/capacitor-ocr';
import { parse } from 'date-fns';

export interface OcrSuggestion {
  description?: string;
  amount?: number;
  dueDate?: string;
  category?: string;
  notes?: string;
  imageUrl?: string;
}

async function getPhoto(source: CameraSource): Promise<Photo> {
  return Camera.getPhoto({
    source,
    resultType: CameraResultType.Uri,
    quality: 90,
    correctOrientation: true,
  });
}

async function fileToDataUrl(photo: Photo): Promise<string | undefined> {
  if (photo.webPath) {
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Não foi possível converter a imagem para preview.'));
        }
      };
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem capturada.'));
      reader.readAsDataURL(blob);
    });
  }

  if (photo.path) {
    return Capacitor.convertFileSrc(photo.path);
  }

  return undefined;
}

async function buildSuggestionFromPhoto(photo: Photo): Promise<OcrSuggestion> {
  const imagePath = photo.path ?? photo.webPath;
  if (!imagePath) {
    throw new Error('Não foi possível obter o caminho da imagem para OCR.');
  }

  const rawText = await extractTextFromImage(imagePath);
  const amount = parseAmount(rawText);
  const dueDate = parseDate(rawText);
  const description = parseDescription(rawText);
  const category = inferCategory(rawText);
  const imageUrl = await fileToDataUrl(photo);

  return {
    description,
    amount,
    dueDate,
    category,
    notes: rawText || undefined,
    imageUrl,
  };
}

export async function scanFromCamera(): Promise<OcrSuggestion> {
  return buildSuggestionFromPhoto(await getPhoto(CameraSource.Camera));
}

export async function scanFromGallery(): Promise<OcrSuggestion> {
  return buildSuggestionFromPhoto(await getPhoto(CameraSource.Photos));
}

async function extractTextFromImage(imagePath: string): Promise<string> {
  const response = await Ocr.process({ image: imagePath });
  return response.results.map((item) => item.text).join('\n').trim();
}

function parseAmount(text: string): number | undefined {
  const currencyPattern = /(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+\.[0-9]{2})/g;
  const matches = [...text.matchAll(currencyPattern)]
    .map((match) => match[1])
    .map((value) => Number.parseFloat(value.replace(/\./g, '').replace(',', '.')))
    .filter((value) => !Number.isNaN(value));

  if (matches.length === 0) {
    return undefined;
  }

  return matches.sort((a, b) => b - a)[0];
}

function parseDate(text: string): string | undefined {
  const match = text.match(/\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/);
  if (!match) {
    return undefined;
  }

  const normalized = `${match[1]}/${match[2]}/${match[3]}`;
  const parsed = parse(normalized, 'dd/MM/yyyy', new Date());
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function inferCategory(text: string): string {
  if (/(energia|eletric|luz|água|agua|gás|gas|condom|aluguel|internet|telefone|celular)/i.test(text)) {
    return 'Casa';
  }
  if (/(uber|99 |taxi|combust|transporte|metrô|metro|ônibus|onibus|pedágio|pedagio)/i.test(text)) {
    return 'Transporte';
  }
  if (/(escola|faculdade|curso|mensalidade|educa)/i.test(text)) {
    return 'Educação';
  }
  if (/(farm|hospital|consulta|cl[ií]nica|sa[úu]de|plano)/i.test(text)) {
    return 'Saúde';
  }
  if (/(iptu|ipva|imposto|darf|tributo|receita)/i.test(text)) {
    return 'Impostos';
  }
  return 'Outros';
}

function parseDescription(text: string): string | undefined {
  const preferredPatterns = [
    /(?:benefici[aá]rio|favorecido|recebedor|vendor|supplier|receiver)[:\s]+(.+)/i,
    /(?:empresa|estabelecimento|raz[aã]o social)[:\s]+(.+)/i,
  ];

  for (const pattern of preferredPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().slice(0, 80);
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && /[A-Za-zÀ-ÿ]/.test(line));

  return lines[0]?.slice(0, 80);
}
