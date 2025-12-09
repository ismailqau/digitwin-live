/* eslint-disable @typescript-eslint/no-explicit-any */

export const readAsStringAsync = jest.fn().mockResolvedValue('base64encodedaudiodata') as any;

export const getInfoAsync = jest.fn().mockResolvedValue({
  exists: true,
  size: 1024,
}) as any;

export const EncodingType = {
  Base64: 'base64',
};
