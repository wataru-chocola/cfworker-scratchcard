import {
  getAssetFromKV,
  serveSinglePageApp,
} from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
const assetManifest = JSON.parse(manifestJSON);

export interface Env {
  SCRATCHCARD_KV: KVNamespace;
  SCRATCHCARD_BUCKET: R2Bucket;

  __STATIC_CONTENT: string;

  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
}

const CANVAS_LENGTH = 500;
const SCRATCH_SIZE = 15;

async function getScratchImage(
  request: Request, // XXX: to prevent cfworkers from caching this func invocation
  env: Env,
  ctx: ExecutionContext
) {
  const images = await env.SCRATCHCARD_BUCKET.list();
  if (images.objects.length === 0) {
    throw Error("Object Not Found");
  }
  const image =
    images.objects[Math.floor(Math.random() * images.objects.length)];
  const imageName = image.key;

  let imageData = await env.SCRATCHCARD_KV.get(imageName, {
    type: "arrayBuffer",
  });
  if (imageData == null) {
    const image = await env.SCRATCHCARD_BUCKET.get(imageName);
    if (!image) {
      throw Error("Object Not Found");
    }
    imageData = await image?.arrayBuffer();
    ctx.waitUntil(
      env.SCRATCHCARD_KV.put(imageName, imageData, { expirationTtl: 600 })
    );
  }

  return imageData;
}

function line(x0: number, y0: number, x1: number, y1: number) {
  const coordinates = new Set<number>();
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;
  let [x, y] = [x0, y0];
  while (true) {
    coordinates.add(x + y * CANVAS_LENGTH);
    if (x === x1 && y === y1) break;

    var e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return coordinates;
}

function calcCoordinates(points: Array<[number, number]>) {
  const coordinates = new Set<number>();
  let lastPoint: [number, number] | null = null;
  for (const curPoint of points) {
    if (lastPoint == null) {
      for (
        let x = Math.max(curPoint[0] - SCRATCH_SIZE, 0);
        x < Math.min(curPoint[0] + SCRATCH_SIZE, CANVAS_LENGTH);
        x++
      ) {
        for (
          let y = Math.max(curPoint[1] - SCRATCH_SIZE, 0);
          y < Math.min(curPoint[1] + SCRATCH_SIZE, CANVAS_LENGTH);
          y++
        ) {
          coordinates.add(x + y * CANVAS_LENGTH);
        }
      }
    } else {
      if (lastPoint[0] !== curPoint[0]) {
        const sign = lastPoint[0] < curPoint[0] ? 1 : -1;
        const sx = lastPoint[0] + sign * SCRATCH_SIZE;
        const dx = curPoint[0] + sign * SCRATCH_SIZE;
        for (let yDelta = -SCRATCH_SIZE; yDelta <= SCRATCH_SIZE; yDelta++) {
          const sy = lastPoint[1] + yDelta;
          const dy = curPoint[1] + yDelta;
          for (const tmp of line(sx, sy, dx, dy)) {
            coordinates.add(tmp);
          }
        }
      }
      if (lastPoint[1] !== curPoint[1]) {
        const sign = lastPoint[1] < curPoint[1] ? 1 : -1;
        const sy = lastPoint[1] + sign * SCRATCH_SIZE;
        const dy = curPoint[1] + sign * SCRATCH_SIZE;
        for (let xDelta = -SCRATCH_SIZE; xDelta <= SCRATCH_SIZE; xDelta++) {
          const sx = lastPoint[0] + xDelta;
          const dx = curPoint[0] + xDelta;
          for (const tmp of line(sx, sy, dx, dy)) {
            coordinates.add(tmp);
          }
        }
      }
    }
    lastPoint = curPoint;
  }
  return coordinates;
}

//async function scratchPoints(
function scratchPoints(
  imageData: ArrayBuffer,
  points: Array<[number, number]>
) {
  const scratchedCoordinates = calcCoordinates(points);
  // msg:
  //   x: 2
  //   y: 2
  //   rgba: 4
  const msgSize = 2 + 2 + 4;
  const payload = new ArrayBuffer(msgSize * scratchedCoordinates.size);
  const payloadView = new DataView(payload);

  const rgba = new Uint8Array(imageData);
  let i = 0;
  for (const coordinate of scratchedCoordinates) {
    const x = coordinate % CANVAS_LENGTH;
    const y = Math.floor(coordinate / CANVAS_LENGTH);
    const pixelOffset = (x + y * 500) * 4;

    payloadView.setUint16(msgSize * i + 0, x);
    payloadView.setUint16(msgSize * i + 2, y);
    payloadView.setUint8(msgSize * i + 4, rgba[pixelOffset]);
    payloadView.setUint8(msgSize * i + 4 + 1, rgba[pixelOffset + 1]);
    payloadView.setUint8(msgSize * i + 4 + 2, rgba[pixelOffset + 2]);
    payloadView.setUint8(msgSize * i + 4 + 3, rgba[pixelOffset + 3]);
    i++;
  }
  return payload;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // websocket endpoint
    if (request.url.includes("/ws-card")) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const imageData = await getScratchImage(request, env, ctx);
      server.accept();
      server.addEventListener("message", (event) => {
        if (event.data instanceof ArrayBuffer) {
          const view = new DataView(event.data);
          const reqPoints: Array<[number, number]> = [];
          for (let i = 0; i < view.byteLength; i += 4) {
            const x = view.getUint16(i + 0);
            const y = view.getUint16(i + 2);
            reqPoints.push([x, y]);
          }
          server.send(scratchPoints(imageData!, reqPoints));
        }
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil(promise) {
            return ctx.waitUntil(promise);
          },
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      //if (e instanceof NotFoundError) {
      //  // ...
      //  return new Response("An unexpected error occurred", { status: 404 });
      //} else if (e instanceof MethodNotAllowedError) {
      //  // ...
      //  return new Response("An unexpected error occurred", { status: 403 });
      //}
      return new Response("An unexpected error occurred", { status: 500 });
    }
  },
};
