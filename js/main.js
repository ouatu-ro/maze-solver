import { rasterToGrid, bfs } from "./mazeSolver.js";
import { THRESHOLD } from "./config.js";

const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("mazeCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");
const overlayEl = document.getElementById("overlay");
const galleryEl = document.getElementById("gallery");
const controlsEl = document.getElementById("controls");
const stageEl = document.getElementById("stage");
const initialPromptEl = document.getElementById("initial-prompt");
const startDrawingBtn = document.getElementById("start-drawing-btn");

const mazeState = {
  mode: "idle", // idle, solving, drawing
  grid: null,
  originalWidth: 0,
  originalHeight: 0,
  scaleFactor: 1,
  startPoint: null,
  endPoint: null,
  path: null,
  loadedImage: null,
  drawColor: "black",
  brushSize: 10,
  drawTool: "brush",
  isDrawing: false,
  lastDrawPoint: null,
};

addEventListeners();
updateControls();
removeSkeletonOnLoad();

function addEventListeners() {
  fileInput.addEventListener("change", handleFileUpload);
  galleryEl.addEventListener("click", handleGalleryClick);
  startDrawingBtn.addEventListener("click", handleStartDrawing);

  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mouseleave", handleMouseUp);
  canvas.addEventListener("touchstart", handleMouseDown, { passive: false });
  canvas.addEventListener("touchmove", handleMouseMove, { passive: false });
  canvas.addEventListener("touchend", handleMouseUp);
  window.addEventListener("resize", () => render());
}

function setMode(newMode) {
  if (mazeState.mode === newMode) {
    mazeState.isDrawing = false;
    mazeState.lastDrawPoint = null;
    updateControls();
    updateUI();
    return;
  }
  mazeState.mode = newMode;
  mazeState.isDrawing = false;
  mazeState.lastDrawPoint = null;
  resetPoints(false);
  updateControls();
  updateUI();
}

function updateUI() {
  const hasImage = !!mazeState.loadedImage;
  initialPromptEl.style.display = hasImage ? "none" : "block";
  canvas.classList.toggle("visible", hasImage);
  if (mazeState.mode === "drawing") {
    canvas.style.cursor =
      mazeState.drawTool === "brush"
        ? "crosshair"
        : mazeState.drawTool === "pan"
        ? "grab"
        : "crosshair";
  } else {
    canvas.style.cursor = "pointer";
  }
  stageEl.classList.toggle("solve", mazeState.mode === "solving");
  stageEl.classList.toggle("draw", mazeState.mode === "drawing");
}

function updateControls() {
  controlsEl.classList.toggle("is-collapsed", mazeState.mode !== "drawing");
  controlsEl.innerHTML = "";

  if (mazeState.mode === "idle") {
    return;
  }

  const modeWrap = document.createElement("div");
  modeWrap.className = "segmented";
  ["solving", "drawing"].forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = m === "solving" ? "Solve" : "Draw";
    btn.className = "segmented__btn";
    if (m === mazeState.mode) {
      btn.classList.add("active");
    }
    btn.onclick = () => setMode(m);
    modeWrap.appendChild(btn);
  });
  controlsEl.appendChild(modeWrap);

  if (mazeState.mode === "solving") {
    if (mazeState.startPoint) {
      const btnClear = document.createElement("button");
      btnClear.textContent = "Clear Selection";
      btnClear.className = "btn-ghost";
      btnClear.onclick = () => resetPoints(true);
      controlsEl.appendChild(btnClear);
    }
  } else if (mazeState.mode === "drawing") {
    const group = document.createElement("div");
    group.className = "drawing-tool-group";

    const row = document.createElement("div");
    row.className = "drawing-tools-row";

    const panBtn = document.createElement("button");
    panBtn.textContent = "Pan/Scroll";
    panBtn.className = mazeState.drawTool === "pan" ? "active" : "";
    panBtn.onclick = () => {
      mazeState.drawTool = "pan";
      updateControls();
      updateUI();
    };

    const brushBtn = document.createElement("button");
    brushBtn.textContent = "Wall (Black)";
    brushBtn.className =
      mazeState.drawTool === "brush" && mazeState.drawColor === "black"
        ? "active"
        : "";
    brushBtn.onclick = () => {
      mazeState.drawTool = "brush";
      mazeState.drawColor = "black";
      updateControls();
      updateUI();
    };

    const eraserBtn = document.createElement("button");
    eraserBtn.textContent = "Path (White)";
    eraserBtn.className =
      mazeState.drawTool === "brush" && mazeState.drawColor === "white"
        ? "active"
        : "";
    eraserBtn.onclick = () => {
      mazeState.drawTool = "brush";
      mazeState.drawColor = "white";
      updateControls();
      updateUI();
    };

    row.append(panBtn, brushBtn, eraserBtn);

    const sizeControl = document.createElement("div");
    sizeControl.className = "size-control";
    sizeControl.classList.toggle("is-disabled", mazeState.drawTool !== "brush");

    const sizeLabel = document.createElement("label");
    sizeLabel.htmlFor = "brush-size";
    sizeLabel.textContent = "Size:";

    const sizeSlider = document.createElement("input");
    sizeSlider.type = "range";
    sizeSlider.id = "brush-size";
    sizeSlider.min = 1;
    sizeSlider.max = 50;
    sizeSlider.value = mazeState.brushSize;
    sizeSlider.oninput = (e) =>
      (mazeState.brushSize = parseInt(e.target.value));

    sizeControl.append(sizeLabel, sizeSlider);

    group.append(row, sizeControl);
    controlsEl.appendChild(group);
  }
}

function handleGalleryClick(event) {
  const card = event.target.closest(".card[data-fullsrc]");
  if (!card) return;
  galleryEl
    .querySelectorAll(".card")
    .forEach((c) => c.classList.remove("selected"));
  card.classList.add("selected");
  loadImage(card.dataset.fullsrc);
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  galleryEl
    .querySelectorAll(".card")
    .forEach((c) => c.classList.remove("selected"));
  loadImage(url, () => URL.revokeObjectURL(url));
}

function handleStartDrawing() {
  const containerWidth = stageEl.clientWidth || 600;
  const newCanvasWidth = containerWidth;
  const newCanvasHeight = Math.round(containerWidth * 0.75);
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = newCanvasWidth;
  tempCanvas.height = newCanvasHeight;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.fillStyle = "white";
  tempCtx.fillRect(0, 0, newCanvasWidth, newCanvasHeight);
  const dataUrl = tempCanvas.toDataURL();
  loadImage(dataUrl).then(() => setMode("drawing"));
}

async function loadImage(src, onLoadCallback) {
  showOverlay(true, "Loading...");
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });
    mazeState.loadedImage = img;
    mazeState.originalWidth = img.naturalWidth;
    mazeState.originalHeight = img.naturalHeight;
    processImageIntoGrid(); // First grid creation from the clean image
    resetPoints(false);
    setMode("solving");
    render();
    setStatus("Click on the image to mark <strong>START</strong>.");
    setStats(`${mazeState.originalWidth}×${mazeState.originalHeight}`);
  } catch (error) {
    setStatus(
      `<span style="color: var(--danger);">Could not load image.</span>`
    );
  } finally {
    showOverlay(false);
    if (onLoadCallback) onLoadCallback();
  }
}

function processImageIntoGrid() {
  if (!mazeState.loadedImage) return;
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = mazeState.originalWidth;
  tempCanvas.height = mazeState.originalHeight;
  tempCtx.drawImage(
    mazeState.loadedImage,
    0,
    0,
    mazeState.originalWidth,
    mazeState.originalHeight
  );

  const imageData = tempCtx.getImageData(
    0,
    0,
    mazeState.originalWidth,
    mazeState.originalHeight
  );
  mazeState.grid = rasterToGrid(imageData, THRESHOLD);
}

function handleMouseDown(event) {
  if (mazeState.mode === "solving") {
    event.preventDefault();
    onCanvasClick(event);
  } else if (mazeState.mode === "drawing") {
    if (mazeState.drawTool === "brush") {
      event.preventDefault();
      mazeState.isDrawing = true;
      const { viewX, viewY } = getCanvasCoordinates(event);
      mazeState.lastDrawPoint = { x: viewX, y: viewY };
      drawOnCanvas(event);
    } else if (mazeState.drawTool === "pan") {
      mazeState.isDrawing = false;
      mazeState.lastDrawPoint = null;
      canvas.style.cursor = "grabbing";
    }
  }
}

function handleMouseMove(event) {
  if (
    mazeState.mode === "drawing" &&
    mazeState.drawTool === "brush" &&
    mazeState.isDrawing
  ) {
    event.preventDefault();
    drawOnCanvas(event);
  }
}

function handleMouseUp() {
  if (mazeState.mode === "drawing") {
    if (mazeState.drawTool === "brush" && mazeState.isDrawing) {
      mazeState.isDrawing = false;
      mazeState.lastDrawPoint = null;
      if (mazeState.loadedImage) {
        mazeState.loadedImage.src = canvas.toDataURL();
        mazeState.loadedImage.onload = () => {
          processImageIntoGrid();
        };
      }
    }
    if (mazeState.drawTool === "pan") {
      canvas.style.cursor = "grab";
    }
  }
}

function onCanvasClick(event) {
  if (!mazeState.grid) return;
  const { dataX, dataY } = getCanvasCoordinates(event);
  const pointer = getPointerEvent(event);

  if (!mazeState.grid[dataY]?.[dataX]) {
    showFloatingMessage(
      "🧱 That's a wall!",
      pointer.clientX,
      pointer.clientY,
      "wall"
    );

    return;
  }
  if (!mazeState.startPoint) {
    mazeState.startPoint = { x: dataX, y: dataY };
    setStatus("Now click to mark the <strong>END</strong> point.");
  } else if (!mazeState.endPoint) {
    mazeState.endPoint = { x: dataX, y: dataY };
    solveMaze();
  } else {
    resetPoints(true);
    mazeState.startPoint = { x: dataX, y: dataY };
    setStatus("New selection! Click to mark the <strong>END</strong> point.");
  }
  render();
  updateControls();
}

function drawOnCanvas(event) {
  if (mazeState.drawTool !== "brush") return;
  const { viewX, viewY } = getCanvasCoordinates(event);
  ctx.beginPath();
  ctx.lineWidth = mazeState.brushSize / mazeState.scaleFactor;
  ctx.strokeStyle = mazeState.drawColor;
  ctx.fillStyle = mazeState.drawColor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (mazeState.lastDrawPoint) {
    ctx.moveTo(mazeState.lastDrawPoint.x, mazeState.lastDrawPoint.y);
    ctx.lineTo(viewX, viewY);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(viewX, viewY, ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.fill();
  mazeState.lastDrawPoint = { x: viewX, y: viewY };
}

function solveMaze() {
  showOverlay(true, "Solving...");
  setTimeout(() => {
    const t0 = performance.now();
    const { path, visited } = bfs(
      mazeState.grid,
      mazeState.startPoint,
      mazeState.endPoint
    );
    const ms = Math.round(performance.now() - t0);
    if (path) {
      mazeState.path = path;
      setStatus(
        'Path drawn in <strong style="color:var(--danger)">red</strong>.'
      );
      setStats(`${path.length} steps · ${visited} visited · ${ms}ms`);
    } else {
      mazeState.path = null;
      setStatus(`<span>🚫 No path found!</span> Try different points.`);

      setStats(`${visited} visited · ${ms}ms`);
      // Display the fading message on the canvas
      if (mazeState.endPoint) {
        const rect = canvas.getBoundingClientRect();
        const viewX = mazeState.endPoint.x / mazeState.scaleFactor;
        const viewY = mazeState.endPoint.y / mazeState.scaleFactor;
        showFloatingMessage(
          "🚫 No path found!",
          viewX + rect.left,
          viewY + rect.top,
          "nopath"
        );
      }
    }
    render();
    updateControls();
    showOverlay(false);
  }, 50);
}

function render() {
  if (!mazeState.loadedImage) {
    updateUI();
    return;
  }
  updateUI();
  const containerWidth = canvas.parentElement.clientWidth;
  if (mazeState.originalWidth === 0) return;
  const displayWidth = containerWidth;
  const displayHeight =
    (containerWidth / mazeState.originalWidth) * mazeState.originalHeight;
  mazeState.scaleFactor = mazeState.originalWidth / displayWidth;
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  ctx.drawImage(mazeState.loadedImage, 0, 0, displayWidth, displayHeight);
  if (mazeState.path) drawPath(mazeState.path);
  if (mazeState.startPoint) drawMarker(mazeState.startPoint, "#2ecc71");
  if (mazeState.endPoint) drawMarker(mazeState.endPoint, "#3498db");
}

function drawMarker(point, color) {
  const viewX = point.x / mazeState.scaleFactor;
  const viewY = point.y / mazeState.scaleFactor;
  const radius = Math.max(5, canvas.width / 150);
  ctx.beginPath();
  ctx.arc(viewX, viewY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPath(path) {
  if (path.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(
    path[0].x / mazeState.scaleFactor,
    path[0].y / mazeState.scaleFactor
  );
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(
      path[i].x / mazeState.scaleFactor,
      path[i].y / mazeState.scaleFactor
    );
  }
  ctx.strokeStyle = "#e74c3c";
  ctx.lineWidth = Math.max(3, canvas.width / 200);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function getPointerEvent(event) {
  return event.touches && event.touches.length > 0 ? event.touches[0] : event;
}

function setStatus(html) {
  statusEl.innerHTML = html;
}
function setStats(text) {
  statsEl.textContent = text;
}
function showOverlay(visible, text = "Loading...") {
  overlayEl.textContent = text;
  overlayEl.classList.toggle("show", visible);
}

function resetPoints(updateStatus = true) {
  mazeState.startPoint = null;
  mazeState.endPoint = null;
  mazeState.path = null;
  if (updateStatus && mazeState.loadedImage) {
    setStatus("Selection cleared! Choose a <strong>START</strong> point.");
    setStats(`${mazeState.originalWidth}×${mazeState.originalHeight}`);
  }
  updateControls();
  render();
}

function removeSkeletonOnLoad() {
  document.querySelectorAll(".thumb").forEach((img) => {
    if (img.complete) {
      img.classList.remove("skeleton");
    } else {
      img.addEventListener("load", () => img.classList.remove("skeleton"), {
        once: true,
      });
    }
  });
}

function getCanvasCoordinates(event) {
  const pointer = getPointerEvent(event);
  const rect = canvas.getBoundingClientRect();
  const viewX = pointer.clientX - rect.left;
  const viewY = pointer.clientY - rect.top;
  const dataX = Math.floor(viewX * mazeState.scaleFactor);
  const dataY = Math.floor(viewY * mazeState.scaleFactor);
  return { viewX, viewY, dataX, dataY };
}

function showFloatingMessage(text, x, y, type = "wall") {
  const msg = document.createElement("div");
  msg.className = `floating-message floating-message--${type}`;
  msg.innerHTML = text;
  msg.style.visibility = "hidden";
  document.body.appendChild(msg);

  const msgWidth = msg.offsetWidth;
  const margin = 16;

  const halfWidth = msgWidth / 2;
  let leftPos = x;

  if (leftPos - halfWidth < margin) {
    leftPos = halfWidth + margin;
  } else if (leftPos + halfWidth > window.innerWidth - margin) {
    leftPos = window.innerWidth - halfWidth - margin;
  }

  const msgHeight = 40;
  const topMargin = 20;
  const direction = y - msgHeight - topMargin < 0 ? 1 : -1;
  msg.style.setProperty("--direction", direction);

  msg.style.left = `${leftPos}px`;
  msg.style.top = `${y}px`;

  msg.style.visibility = "visible";

  setTimeout(() => {
    msg.remove();
  }, 1800);
}
