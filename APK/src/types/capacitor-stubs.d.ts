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
  };
}

declare module '@capacitor/camera' {
  export interface Photo {
    base64String?: string;
    format?: string;
  }
  export enum CameraResultType {
    Base64 = 'base64',
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

declare module '@capacitor-mlkit/text-recognition' {
  export const TextRecognition: unknown;
}

declare module '*.css';
