declare module 'react-native-permissions' {
  export type Permission = string;

  export enum RESULTS {
    UNAVAILABLE = 'unavailable',
    DENIED = 'denied',
    LIMITED = 'limited',
    GRANTED = 'granted',
    BLOCKED = 'blocked',
  }

  export const PERMISSIONS: {
    IOS: {
      MICROPHONE: Permission;
      CAMERA: Permission;
      PHOTO_LIBRARY: Permission;
      [key: string]: Permission;
    };
    ANDROID: {
      RECORD_AUDIO: Permission;
      CAMERA: Permission;
      READ_EXTERNAL_STORAGE: Permission;
      WRITE_EXTERNAL_STORAGE: Permission;
      [key: string]: Permission;
    };
  };

  export function check(permission: Permission): Promise<RESULTS>;

  export function request(permission: Permission): Promise<RESULTS>;

  export function checkMultiple(permissions: Permission[]): Promise<Record<Permission, RESULTS>>;

  export function requestMultiple(permissions: Permission[]): Promise<Record<Permission, RESULTS>>;
}
