import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import http from "http";
import fsPromise from "fs/promises";
import path from "path";

const CANVAS_LENGTH = 500;
const SCRATCH_SIZE = 15;

export function createWSS(server: http.Server, imagedir: string) {
  async function getScratchImage() {
    const entries = await fsPromise.readdir(imagedir, { withFileTypes: true });
    const images = entries.filter((e) => e.isFile());
    if (images.length === 0) {
      throw Error("Object Not Found");
    }

    const image = images[Math.floor(Math.random() * images.length)];
    const imageFile = path.join(imagedir, image.name);

    const imageData = await fsPromise.readFile(imageFile);
    const arrayBuf = imageData.buffer.slice(
      imageData.byteOffset,
      imageData.byteOffset + imageData.byteLength - 1
    );
    return arrayBuf;
  }

  function line(x0: number, y0: number, x1: number, y1: number) {
    const coordinates = new Set<number>();
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    let err = dx - dy;
    let [x, y] = [x0, y0];
    while (true) {
      coordinates.add(x + y * CANVAS_LENGTH);
      if (x === x1 && y === y1) break;

      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return coordinates;
  }

  function calcCoordinates(points: Array<[number, number]>) {
    const coordinates = new Set<number>();
    let lastPoint: [number, number] | null = null;
    for (const curPoint of points) {
      if (lastPoint == null) {
        for (
          let x = Math.max(curPoint[0] - SCRATCH_SIZE, 0);
          x < Math.min(curPoint[0] + SCRATCH_SIZE, CANVAS_LENGTH);
          x++
        ) {
          for (
            let y = Math.max(curPoint[1] - SCRATCH_SIZE, 0);
            y < Math.min(curPoint[1] + SCRATCH_SIZE, CANVAS_LENGTH);
            y++
          ) {
            coordinates.add(x + y * CANVAS_LENGTH);
          }
        }
      } else {
        if (lastPoint[0] !== curPoint[0]) {
          const sign = lastPoint[0] < curPoint[0] ? 1 : -1;
          const sx = lastPoint[0] + sign * SCRATCH_SIZE;
          const dx = curPoint[0] + sign * SCRATCH_SIZE;
          for (let yDelta = -SCRATCH_SIZE; yDelta <= SCRATCH_SIZE; yDelta++) {
            const sy = lastPoint[1] + yDelta;
            const dy = curPoint[1] + yDelta;
            for (const tmp of line(sx, sy, dx, dy)) {
              coordinates.add(tmp);
            }
          }
        }
        if (lastPoint[1] !== curPoint[1]) {
          const sign = lastPoint[1] < curPoint[1] ? 1 : -1;
          const sy = lastPoint[1] + sign * SCRATCH_SIZE;
          const dy = curPoint[1] + sign * SCRATCH_SIZE;
          for (let xDelta = -SCRATCH_SIZE; xDelta <= SCRATCH_SIZE; xDelta++) {
            const sx = lastPoint[0] + xDelta;
            const dx = curPoint[0] + xDelta;
            for (const tmp of line(sx, sy, dx, dy)) {
              coordinates.add(tmp);
            }
          }
        }
      }
      lastPoint = curPoint;
    }
    return coordinates;
  }

  function scratchPoints(
    imageData: ArrayBuffer,
    points: Array<[number, number]>
  ) {
    const scratchedCoordinates = calcCoordinates(points);
    // msg:
    //   x: 2
    //   y: 2
    //   rgba: 4
    const msgSize = 2 + 2 + 4;
    const payload = new ArrayBuffer(msgSize * scratchedCoordinates.size);
    const payloadView = new DataView(payload);

    const rgba = new Uint8Array(imageData);
    let i = 0;
    for (const coordinate of scratchedCoordinates) {
      const x = coordinate % CANVAS_LENGTH;
      const y = Math.floor(coordinate / CANVAS_LENGTH);
      const pixelOffset = (x + y * 500) * 4;

      payloadView.setUint16(msgSize * i + 0, x);
      payloadView.setUint16(msgSize * i + 2, y);
      payloadView.setUint8(msgSize * i + 4, rgba[pixelOffset]);
      payloadView.setUint8(msgSize * i + 4 + 1, rgba[pixelOffset + 1]);
      payloadView.setUint8(msgSize * i + 4 + 2, rgba[pixelOffset + 2]);
      payloadView.setUint8(msgSize * i + 4 + 3, rgba[pixelOffset + 3]);
      i++;
    }
    return payload;
  }

  async function handleConnection(ws: WebSocket) {
    const imageData = await getScratchImage();
    ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        console.log("text: " + data);
        return;
      }
      const buf = data as Buffer;
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const reqPoints: Array<[number, number]> = [];
      for (let i = 0; i < view.byteLength; i += 4) {
        const x = view.getUint16(i + 0);
        const y = view.getUint16(i + 2);
        reqPoints.push([x, y]);
      }
      ws.send(scratchPoints(imageData!, reqPoints));
    });
  }

  const wss = new WebSocketServer({ server });
  wss.on("connection", handleConnection);
}
