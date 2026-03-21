declare module '@capacitor/cli' {
  export interface CapacitorConfig {
    appId: string;
    appName: string;
    webDir: string;
    plugins?: Record<string, unknown>;
  }
}

declare module '@capacitor/core' {
  export const Capacitor: {
    getPlatform(): string;
    convertFileSrc(path: string): string;
  };
}

declare module '@capacitor/camera' {
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
  export const Camera: {
    getPhoto(options: {
      source: CameraSource;
      resultType: CameraResultType;
      quality?: number;
      correctOrientation?: boolean;
    }): Promise<Photo>;
  };
}

declare module '@capacitor/haptics' {
  export enum ImpactStyle {
    Light = 'LIGHT',
    Medium = 'MEDIUM',
    Heavy = 'HEAVY',
  }
  export const Haptics: {
    impact(options: { style: ImpactStyle }): Promise<void>;
  };
}

declare module '@capacitor/dialog' {
  export const Dialog: {
    confirm(options: { title: string; message: string }): Promise<{ value: boolean }>;
  };
}

declare module '@capacitor-community/sqlite' {
  export interface SQLiteDBConnection {
    open(): Promise<void>;
    execute(statement: string): Promise<unknown>;
    query(statement: string, values?: unknown[]): Promise<{ values?: unknown[] }>;
    run(statement: string, values?: unknown[]): Promise<unknown>;
  }
  export class SQLiteConnection {
    constructor(plugin: unknown);
    checkConnectionsConsistency(): Promise<{ result: boolean }>;
    isConnection(name: string, readonly: boolean): Promise<{ result: boolean }>;
    retrieveConnection(name: string, readonly: boolean): Promise<SQLiteDBConnection>;
    createConnection(name: string, encrypted: boolean, mode: string, version: number, readonly: boolean): Promise<SQLiteDBConnection>;
    saveToStore(name: string): Promise<void>;
  }
  export const CapacitorSQLite: {
    initWebStore(): Promise<void>;
  };
}

declare module '@capacitor-community/image-to-text' {
  export interface TextDetection {
    text: string;
  }

  export interface TextDetections {
    textDetections: TextDetection[];
  }

  export const ImageToText: {
    detectText(options: { filename: string }): Promise<TextDetections>;
  };
}

  export interface RecognitionResults {
    results: RecognitionResult[];
  }

  export const Ocr: {
    process(options: { image: string }): Promise<RecognitionResults>;
  };
}

declare module '*.css';
