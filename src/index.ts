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

async function getScratchImage(env: Env, ctx: ExecutionContext) {
  const imageName = "genbaneko.png.bin";

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

async function scratchPoint(imageData: ArrayBuffer, x: number, y: number) {
  const CANVAS_WIDTH = 500;
  const SIZE = 5;
  const [origin_x, origin_y] = [x - SIZE, y - SIZE];
  const rgba = new Uint8Array(imageData);

  const HEADER_SIZE = 2 + 2;
  const payload = new ArrayBuffer(HEADER_SIZE + (SIZE * 2 + 1) ** 2 * 4);
  const payloadView = new DataView(payload);
  payloadView.setUint16(0, origin_x);
  payloadView.setUint16(2, origin_y);

  const imagedata = new Uint8Array(payload, HEADER_SIZE);
  for (let i = origin_x; i <= origin_x + SIZE * 2; i += 1) {
    if (i < 0 || i > CANVAS_WIDTH - 1) {
      continue;
    }

    for (let j = origin_y; j <= origin_y + SIZE * 2; j += 1) {
      if (j < 0 || j > CANVAS_WIDTH - 1) {
        continue;
      }
      const srcOffset = (500 * j + i) * 4;
      const dstOffset = ((j - origin_y) * 11 + (i - origin_x)) * 4;
      imagedata[dstOffset] = rgba[srcOffset];
      imagedata[dstOffset + 1] = rgba[srcOffset + 1];
      imagedata[dstOffset + 2] = rgba[srcOffset + 2];
      imagedata[dstOffset + 3] = rgba[srcOffset + 3];
    }
  }

  return payload;
}

async function scratchPoints(
  imageData: ArrayBuffer,
  points: Array<[number, number]>
) {
  const SIZE = 5;
  const HEADER_SIZE = 2 + 2;
  const payload = new ArrayBuffer(
    (HEADER_SIZE + (SIZE * 2 + 1) ** 2 * 4) * points.length
  );
  const view = new Uint8Array(payload);
  for (let i = 0; i < points.length; i++) {
    const tmp = new Uint8Array(
      await scratchPoint(imageData, points[i][0], points[i][1])
    );
    view.set(tmp, (HEADER_SIZE + (SIZE * 2 + 1) ** 2 * 4) * i);
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

      const imageData = await getScratchImage(env, ctx);
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
          scratchPoints(imageData, reqPoints)
            .then((payload) => server.send(payload))
            .catch((e) => {
              console.log(e);
            });
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
