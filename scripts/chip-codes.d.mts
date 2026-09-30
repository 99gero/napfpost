export const CODE_LENGTH: number;
export const CODE_ALPHABET: string;
export const BATCH_RE: RegExp;
export function generateCode(bytes?: (n: number) => Uint8Array): string;
export function generateCodes(count: number, bytes?: (n: number) => Uint8Array, exclude?: Set<string>): string[];
export function toCsv(codes: string[], baseUrl: string, batch: string): string;
export function toSql(codes: string[], batch: string): string;
