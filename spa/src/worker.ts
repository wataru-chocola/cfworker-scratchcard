export {};

let ctx: CanvasRenderingContext2D | null;

type PayloadCanvas = {
  canvas: HTMLCanvasElement;
};

type PayloadResponse = {
  imageData: ArrayBuffer;
};

function isPayloadCanvas(d: unknown): d is PayloadCanvas {
  return (d as PayloadCanvas).canvas !== undefined;
}

function isPayloadResponse(d: unknown): d is PayloadResponse {
  return (d as PayloadResponse).imageData !== undefined;
}

onmessage = (event) => {
  if (isPayloadCanvas(event.data)) {
    const offscreenCanvas = event.data.canvas;
    ctx = offscreenCanvas.getContext("2d");
  } else if (isPayloadResponse(event.data)) {
    const msgSize = 2 + 2 + 4;
    const view = new DataView(event.data.imageData);
    for (
      let offset = 0;
      offset < event.data.imageData.byteLength;
      offset += msgSize
    ) {
      const x = view.getUint16(offset + 0);
      const y = view.getUint16(offset + 2);
      const data = new Uint8ClampedArray(4);
      data[0] = view.getUint8(offset + 4);
      data[1] = view.getUint8(offset + 4 + 1);
      data[2] = view.getUint8(offset + 4 + 2);
      data[3] = view.getUint8(offset + 4 + 3);
      const image = new ImageData(data, 1, 1);
      ctx?.putImageData(image, x, y);
    }
  }
};
