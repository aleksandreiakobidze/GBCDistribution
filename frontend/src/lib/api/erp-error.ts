import axios from 'axios';

export type ErpErrorInfo = {
  code?: string;
  message: string;
};

export function erpErrorFromUnknown(error: unknown, fallback: string): ErpErrorInfo {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { code?: string; message?: string } | undefined;
    return {
      code: data?.code,
      message: data?.message || fallback,
    };
  }
  if (error instanceof Error && error.message) {
    return { message: error.message };
  }
  return { message: fallback };
}
