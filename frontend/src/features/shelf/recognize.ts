export type Detection = {
  itemId: string;
  shelfNo: number;
  price: number | null;
  box: { x: number; y: number; w: number; h: number };
};

let modelReady: boolean | null = null;

async function modelAvailable(): Promise<boolean> {
  if (modelReady !== null) {
    return modelReady;
  }
  try {
    const response = await fetch('/models/shelf.onnx', { method: 'HEAD' });
    modelReady = response.ok;
  } catch {
    modelReady = false;
  }
  return modelReady;
}

/**
 * Fills boxes from shelf.onnx when that file and a runtime are both present.
 * Until then the sales rep attaches each product to a box.
 */
async function detectWithModel(_image: Blob): Promise<Detection[]> {
  return [];
}

export async function recognize(image: Blob): Promise<Detection[]> {
  const available = await modelAvailable();
  if (!available) {
    return [];
  }
  return detectWithModel(image);
}
