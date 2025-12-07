/**
 * Mock for expo-file-system
 */

export const documentDirectory = 'file:///mock/documents/';
export const cacheDirectory = 'file:///mock/cache/';

export const getInfoAsync = jest.fn(async () => ({
  exists: true,
  isDirectory: false,
  size: 1024,
  modificationTime: Date.now(),
  uri: 'file:///mock/file.txt',
}));

export const readAsStringAsync = jest.fn(async () => 'mock file content');

export const writeAsStringAsync = jest.fn(async () => {});

export const deleteAsync = jest.fn(async () => {});

export const moveAsync = jest.fn(async () => {});

export const copyAsync = jest.fn(async () => {});

export const makeDirectoryAsync = jest.fn(async () => {});

export const readDirectoryAsync = jest.fn(async () => []);

export const downloadAsync = jest.fn(async () => ({
  uri: 'file:///mock/downloaded.txt',
  status: 200,
  headers: {},
  md5: 'mock-md5',
}));

export const uploadAsync = jest.fn(async () => ({
  status: 200,
  headers: {},
  body: 'mock response',
}));

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};

export const FileSystemSessionType = {
  BACKGROUND: 0,
  FOREGROUND: 1,
};

export default {
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  moveAsync,
  copyAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
  downloadAsync,
  uploadAsync,
  EncodingType,
  FileSystemSessionType,
};
