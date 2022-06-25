import React from "react";

export function Scratchcard() {
  const [ws, setWS] = React.useState<WebSocket>();
  const [worker, setWorker] = React.useState<Worker>();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url));
    // Only Chrome supports this method.
    // @ts-ignore
    const offscreenCanvas = canvasRef.current?.transferControlToOffscreen();
    worker.postMessage({ canvas: offscreenCanvas }, [offscreenCanvas]);
    setWorker(worker);
  }, [setWorker]);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws-card";
    url.search = "";
    url.hash = "";
    const newWS = new WebSocket(url);
    newWS.binaryType = "arraybuffer";
    setWS(newWS);

    return () => {
      newWS.close();
    };
  }, [setWS]);

  React.useEffect(() => {
    if (ws && worker) {
      ws.addEventListener("message", (event) => {
        if (event.data instanceof ArrayBuffer) {
          console.log("+ received: ", event.data.byteLength);
          worker?.postMessage({ imageData: event.data });
        } else {
          console.log("text: " + event.data);
        }
      });
    }
  }, [ws, worker]);

  React.useEffect(() => {
    let scratching = false;
    let lastPoint: [number, number] | null = null;

    const sendReqs = (reqs: [number, number][]) => {
      if (reqs.length === 0) return;

      if (lastPoint) {
        reqs.unshift(lastPoint);
      }
      const data = new DataView(new ArrayBuffer(2 * 2 * reqs.length));
      for (let i = 0; i < reqs.length; i++) {
        data.setUint16(2 * 2 * i + 0, reqs[i][0]);
        data.setUint16(2 * 2 * i + 2, reqs[i][1]);
      }
      ws?.send(data.buffer);
    };

    const listenerToStartScratching = (e: MouseEvent) => {
      scratching = true;
      sendReqs([[e.offsetX, e.offsetY]]);
    };
    const listenerToEndScratching = (e: MouseEvent) => {
      if (scratching) {
        sendReqs([[e.offsetX, e.offsetY]]);
        scratching = false;
        lastPoint = null;
      }
    };
    const pointerTracker = (event: PointerEvent) => {
      if (scratching) {
        const reqs: Array<[number, number]> = [];
        // FYI: https://developer.mozilla.org/ja/docs/Web/API/PointerEvent/getCoalescedEvents
        for (const e of event.getCoalescedEvents()) {
          reqs.push([e.offsetX, e.offsetY]);
        }
        sendReqs(reqs);
      }
    };
    canvasRef?.current?.addEventListener(
      "mousedown",
      listenerToStartScratching
    );
    document.addEventListener("mouseup", listenerToEndScratching);
    canvasRef?.current?.addEventListener("pointermove", pointerTracker);
  });
  return (
    <canvas
      id="scratchcard"
      className="App-canvas"
      width="500"
      height="500"
      ref={canvasRef}
    ></canvas>
  );
}
