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
  const imageName = "genbaneko.png";

  let imageData = await env.SCRATCHCARD_KV.get(imageName, {
    type: "arrayBuffer",
  });
  if (imageData == null) {
    const image = await env.SCRATCHCARD_BUCKET.get(imageName);
    if (!image) {
      return new Response("Object Not Found", { status: 404 });
    }
    imageData = await image?.arrayBuffer();
    ctx.waitUntil(
      env.SCRATCHCARD_KV.put(imageName, imageData, { expirationTtl: 600 })
    );
  }

  return new Response(imageData);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.url.includes("/api/card")) {
      return await getScratchImage(env, ctx);
    } else if (request.url.includes("/ws-card")) {
      // websocket endpoint
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      server.addEventListener("message", (event) => {
        console.log(event.data);
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
