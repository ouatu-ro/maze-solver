// --- DOM Elements ---
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

// --- State ---
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
  isDrawing: false,
  lastDrawPoint: null,
};

// --- Initialization ---
addEventListeners();
updateControls();
removeSkeletonOnLoad();

// --- Event Listeners ---
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

// --- Mode & UI Management ---
function setMode(newMode) {
  mazeState.mode = newMode;
  resetPoints(false);
  updateControls();
  updateUI();
}

function updateUI() {
  const hasImage = !!mazeState.loadedImage;
  initialPromptEl.style.display = hasImage ? "none" : "block";
  canvas.classList.toggle("visible", hasImage);
  canvas.style.cursor = mazeState.mode === "drawing" ? "crosshair" : "pointer";
}

function updateControls() {
  controlsEl.innerHTML = "";
  if (mazeState.mode === "idle") return;

  const toggleModeBtn = document.createElement("button");
  toggleModeBtn.textContent =
    mazeState.mode === "solving" ? "Edit Maze (Draw)" : "Find Path (Solve)";
  toggleModeBtn.onclick = () =>
    setMode(mazeState.mode === "solving" ? "drawing" : "solving");
  controlsEl.appendChild(toggleModeBtn);

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
    const brushBtn = document.createElement("button");
    brushBtn.textContent = "Wall (Black)";
    brushBtn.className = mazeState.drawColor === "black" ? "active" : "";
    brushBtn.onclick = () => {
      mazeState.drawColor = "black";
      updateControls();
    };
    const eraserBtn = document.createElement("button");
    eraserBtn.textContent = "Path (White)";
    eraserBtn.className = mazeState.drawColor === "white" ? "active" : "";
    eraserBtn.onclick = () => {
      mazeState.drawColor = "white";
      updateControls();
    };
    const sizeLabel = document.createElement("label");
    sizeLabel.htmlFor = "brush-size";
    sizeLabel.textContent = "Size:";
    const sizeSlider = document.createElement("input");
    sizeSlider.type = "range";
    sizeSlider.id = "brush-size";
    sizeSlider.min = 1;
    sizeSlider.max = 50;
    sizeSlider.value = mazeState.brushSize;
    sizeSlider.oninput = (e) => {
      mazeState.brushSize = parseInt(e.target.value);
    };
    group.append(brushBtn, eraserBtn, sizeLabel, sizeSlider);
    controlsEl.appendChild(group);
  }
}

// --- Image & Canvas Handling ---

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
  const data = imageData.data;
  const threshold = 128;
  mazeState.grid = [];
  for (let y = 0; y < mazeState.originalHeight; y++) {
    mazeState.grid[y] = [];
    for (let x = 0; x < mazeState.originalWidth; x++) {
      const index = (y * mazeState.originalWidth + x) * 4;
      const gray = (data[index] + data[index + 1] + data[index + 2]) / 3;
      mazeState.grid[y][x] = gray > threshold;
    }
  }
}

// --- Main Event Handlers (Mouse Down/Move/Up) ---

function handleMouseDown(event) {
  event.preventDefault();
  if (mazeState.mode === "solving") {
    onCanvasClick(event);
  } else if (mazeState.mode === "drawing") {
    mazeState.isDrawing = true;
    const { viewX, viewY } = getCanvasCoordinates(event);
    mazeState.lastDrawPoint = { x: viewX, y: viewY };
    drawOnCanvas(event);
  }
}

function handleMouseMove(event) {
  event.preventDefault();
  if (mazeState.mode === "drawing" && mazeState.isDrawing) {
    drawOnCanvas(event);
  }
}

function handleMouseUp() {
  if (mazeState.mode === "drawing" && mazeState.isDrawing) {
    mazeState.isDrawing = false;
    mazeState.lastDrawPoint = null;
    mazeState.loadedImage.src = canvas.toDataURL();
    mazeState.loadedImage.onload = () => {
      processImageIntoGrid();
    };
  }
}

// --- Core Logic (Solving and Drawing) ---

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

// --- Drawing & Rendering ---
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

// --- Helper Functions ---
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

function bfs(grid, start, end) {
  const width = grid[0].length;
  const height = grid.length;
  let visitedCount = 0;
  const queue = [start];
  const visited = new Set([`${start.y},${start.x}`]);
  visitedCount++;
  const prev = new Map();
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  while (queue.length) {
    const current = queue.shift();
    if (current.x === end.x && current.y === end.y) {
      const path = [];
      let at = end;
      while (at) {
        path.push(at);
        at = prev.get(`${at.y},${at.x}`);
      }
      return { path: path.reverse(), visited: visitedCount };
    }
    for (const [dx, dy] of dirs) {
      const nextX = current.x + dx;
      const nextY = current.y + dy;
      const key = `${nextY},${nextX}`;
      if (
        nextX >= 0 &&
        nextX < width &&
        nextY >= 0 &&
        nextY < height &&
        grid[nextY][nextX] &&
        !visited.has(key)
      ) {
        visited.add(key);
        visitedCount++;
        prev.set(key, current);
        queue.push({ x: nextX, y: nextY });
      }
    }
  }
  return { path: null, visited: visitedCount };
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
