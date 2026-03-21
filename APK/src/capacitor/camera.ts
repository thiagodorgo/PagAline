export interface Photo {
  base64String?: string;
  format?: string;
  path?: string;
  webPath?: string;
}

export enum CameraResultType {
  Base64 = 'base64',
  Uri = 'uri',
}

export enum CameraSource {
  Camera = 'CAMERA',
  Photos = 'PHOTOS',
}

type CameraOptions = {
  source: CameraSource;
  resultType: CameraResultType;
  quality?: number;
  correctOrientation?: boolean;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Não foi possível ler a imagem selecionada.'));
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.readAsDataURL(file);
  });
}

function pickImageFromDevice(source: CameraSource): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === CameraSource.Camera) {
      input.capture = 'environment';
    }

    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0];
        if (file) {
          resolve(file);
          return;
        }
        reject(new Error('Nenhuma imagem foi selecionada.'));
      },
      { once: true },
    );

    input.click();
  });
}

export const Camera = {
  async getPhoto(options: CameraOptions): Promise<Photo> {
    const file = await pickImageFromDevice(options.source);
    const webPath = URL.createObjectURL(file);
    const format = file.type.split('/')[1] || 'jpeg';

    if (options.resultType === CameraResultType.Base64) {
      const dataUrl = await fileToDataUrl(file);
      const base64String = dataUrl.split(',')[1] ?? '';
      return {
        base64String,
        format,
        webPath,
      };
    }

    return {
      format,
      path: webPath,
      webPath,
    };
  },
};
