import React from "react";
import "./App.css";

function App() {
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
    let reqs: Array<[number, number]> = [];
    const listenerToStartScratching = (e: MouseEvent) => {
      scratching = true;
    };
    const listenerToEndScratching = (e: MouseEvent) => {
      if (scratching) {
        scratching = false;
      }
    };
    const pointerTracker = (event: PointerEvent) => {
      if (scratching) {
        // FYI: https://developer.mozilla.org/ja/docs/Web/API/PointerEvent/getCoalescedEvents
        for (const e of event.getCoalescedEvents()) {
          reqs.push([e.offsetX, e.offsetY]);
        }
      }
    };
    canvasRef?.current?.addEventListener(
      "mousedown",
      listenerToStartScratching
    );
    document.addEventListener("mouseup", listenerToEndScratching);
    canvasRef?.current?.addEventListener("pointermove", pointerTracker);

    const timerId = setInterval(() => {
      if (reqs.length > 0) {
        const data = new DataView(new ArrayBuffer(2 * 2 * reqs.length));
        for (let i = 0; i < reqs.length; i++) {
          data.setUint16(2 * 2 * i + 0, reqs[i][0]);
          data.setUint16(2 * 2 * i + 2, reqs[i][1]);
        }
        ws?.send(data.buffer);
        reqs = [];
      }
    }, 5);
    return () => clearInterval(timerId);
  });
  return (
    <div className="App">
      <header className="App-header">
        <h1>Cats Lottery</h1>
      </header>
      <canvas
        id="scratchcard"
        className="App-canvas"
        width="500"
        height="500"
        ref={canvasRef}
      ></canvas>
    </div>
  );
}

export default App;
