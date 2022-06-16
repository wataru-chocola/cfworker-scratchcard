/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  SCRATCHCARD_KV: KVNamespace;
  SCRATCHCARD_BUCKET: R2Bucket;

  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
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
  },
};
