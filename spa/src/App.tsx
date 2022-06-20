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
    setWS(newWS);
    return () => newWS.close();
  }, [setWS]);

  React.useEffect(() => {
    let scratching = false;
    const mouseDownListener: EventListener = (e) => {
      console.log(e);
      scratching = true;
    };
    const mouseUpListener: EventListener = (e) => {
      console.log(e);
      if (scratching) {
        scratching = false;
      }
    };
    const mouseMoveTracker: EventListener = (e) => {
      if (scratching) {
        console.log(e);
        ws?.send("dummy");
      }
    };
    canvasRef?.current?.addEventListener("mousedown", mouseDownListener);
    canvasRef?.current?.addEventListener("mouseup", mouseUpListener);
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
