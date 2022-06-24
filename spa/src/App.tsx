import React from "react";
import "./App.css";

function App() {
  const [ws, setWS] = React.useState<WebSocket>();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws-card";
    url.search = "";
    url.hash = "";
    const newWS = new WebSocket(url);
    newWS.binaryType = "arraybuffer";
    setWS(newWS);
    const ctx = canvasRef.current?.getContext("2d");
    newWS.addEventListener("message", (event) => {
      if (event.data instanceof ArrayBuffer) {
        const pixelDataSize = 11 * 11 * 4;
        const msgSize = 4 + pixelDataSize;
        for (
          let offset = 0;
          offset < event.data.byteLength;
          offset += msgSize
        ) {
          const data = new ImageData(
            new Uint8ClampedArray(event.data, offset + 4, pixelDataSize),
            11,
            11
          );
          const view = new DataView(event.data);
          const x = view.getUint16(offset + 0) - 5;
          const y = view.getUint16(offset + 2) - 5;
          ctx?.putImageData(data, x, y);
        }
      } else {
        console.log("text: " + event.data);
      }
    });

    return () => {
      newWS.close();
    };
  }, [setWS]);

  React.useEffect(() => {
    let scratching = false;
    let reqs: Array<[number, number]> = [];
    const cached = new Uint8Array(500 * 500);
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
          if (cached[e.offsetX + e.offsetY * 500] === 0) {
            reqs.push([e.offsetX, e.offsetY]);
            cached[e.offsetX + e.offsetY * 500] = 1;
          }
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
    }, 10);
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
