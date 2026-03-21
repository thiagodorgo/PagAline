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

declare module '*.css';
