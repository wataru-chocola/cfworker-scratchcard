import React from "react";
import "./App.css";

function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const removeMouseTracker = canvasRef?.current?.addEventListener(
      "mousemove",
      (e) => console.log(e)
    );
    return removeMouseTracker;
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
