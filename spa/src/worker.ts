export {};

let ctx: CanvasRenderingContext2D | null;
let rendered = new Set<number>();
let image: ImageData | null;

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

function draw() {
  image != null && ctx?.putImageData(image, 0, 0);
  requestAnimationFrame(draw);
}

onmessage = (event) => {
  if (isPayloadCanvas(event.data)) {
    const offscreenCanvas = event.data.canvas;
    ctx = offscreenCanvas.getContext("2d", {
      // for performance
      desynchronized: true,
      alpha: false,
    });
    const bgImageDataBuf = new Uint8ClampedArray(
      new ArrayBuffer(500 * 500 * 4)
    );
    for (let offset = 0; offset < bgImageDataBuf.byteLength; offset += 4) {
      bgImageDataBuf[0] = 0xc0;
      bgImageDataBuf[1] = 0xc0;
      bgImageDataBuf[2] = 0xc0;
    }
    image = new ImageData(bgImageDataBuf, 500, 500);
    draw();
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
      if (rendered.has(x + y * 500)) {
        continue;
      }

      image!.data[(x + y * 500) * 4] = view.getUint8(offset + 4);
      image!.data[(x + y * 500) * 4 + 1] = view.getUint8(offset + 4 + 1);
      image!.data[(x + y * 500) * 4 + 2] = view.getUint8(offset + 4 + 2);
      image!.data[(x + y * 500) * 4 + 3] = view.getUint8(offset + 4 + 3);
      rendered.add(x + y * 500);
    }
  }
};
