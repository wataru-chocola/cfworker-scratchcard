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
        console.log("+ received: ", event.data.byteLength);
        const msgSize = 2 + 2 + 4;
        const view = new DataView(event.data);

        //const data = new Uint8ClampedArray(500 * 500 * 4);
        for (
          let offset = 0;
          offset < event.data.byteLength;
          offset += msgSize
        ) {
          const x = view.getUint16(offset + 0);
          const y = view.getUint16(offset + 2);
          //const pixelOffset = (x + y * 500) * 4;
          //data[pixelOffset] = view.getUint8(offset + 4);
          //data[pixelOffset + 1] = view.getUint8(offset + 4 + 1);
          //data[pixelOffset + 2] = view.getUint8(offset + 4 + 2);
          //data[pixelOffset + 3] = view.getUint8(offset + 4 + 3);
          const data = new Uint8ClampedArray(4);
          data[0] = view.getUint8(offset + 4);
          data[1] = view.getUint8(offset + 4 + 1);
          data[2] = view.getUint8(offset + 4 + 2);
          data[3] = view.getUint8(offset + 4 + 3);
          const image = new ImageData(data, 1, 1);
          ctx?.putImageData(image, x, y);
        }
        //const image = new ImageData(data, 500, 500);
        //ctx?.putImageData(image, 0, 0);
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
