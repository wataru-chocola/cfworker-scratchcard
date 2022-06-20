import React, { MouseEvent } from "react";
import "./App.css";

function App() {
  const [ws, setWS] = React.useState<WebSocket>();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  //React.useEffect(() => {
  //  const newWS = new WebSocket("ws:///ws-card");
  //  setWS(newWS);
  //  return () => newWS.close();
  //}, [setWS]);

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
