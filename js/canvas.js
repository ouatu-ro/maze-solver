import * as CONFIG from "./config.js";

let ctx;

/**
 * Initializes the module with the canvas element's context.
 */
export function initCanvas(canvasElement) {
  ctx = canvasElement.getContext("2d");
  return ctx;
}

/**
 * Draws a marker (a colored circle) at a given point.
 */
export function drawMarker(pt, color) {
  if (!ctx || !pt) return;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, CONFIG.MARKER_R, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5; // Slightly thicker for visibility
  ctx.strokeStyle = "rgba(0,0,0,.5)";
  ctx.stroke();
}

/**
 * Draws the solution path on the canvas.
 */
export function drawPath(path) {
  if (!ctx || !path || path.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.strokeStyle = "#e74c3c"; // A brighter red
  ctx.lineCap = "round"; // Nicer line ends
  ctx.lineJoin = "round"; // Nicer corners
  ctx.lineWidth = CONFIG.PATH_WIDTH;
  ctx.stroke();
}
