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
    newWS.addEventListener("message", (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Uint8 is safe to decode network data
        const data = new Uint8Array(event.data);
        console.log(data);
      } else {
        console.log("text: " + event.data);
      }
    });
    return () => newWS.close();
  }, [setWS]);

  React.useEffect(() => {
    let scratching = false;
    const listenerToStartScratching = (e: MouseEvent) => {
      scratching = true;
    };
    const listenerToEndScratching = (e: MouseEvent) => {
      if (scratching) {
        scratching = false;
      }
    };
    const mouseMoveTracker = (e: MouseEvent) => {
      if (scratching) {
        const data = new DataView(new ArrayBuffer(2 * 2));
        data.setUint16(0, e.offsetX);
        data.setUint16(2, e.offsetY);
        ws?.send(data.buffer);
      }
    };
    canvasRef?.current?.addEventListener(
      "mousedown",
      listenerToStartScratching
    );
    canvasRef?.current?.addEventListener("mouseup", listenerToEndScratching);
    canvasRef?.current?.addEventListener("mouseleave", listenerToEndScratching);
    canvasRef?.current?.addEventListener("mousemove", mouseMoveTracker);
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
