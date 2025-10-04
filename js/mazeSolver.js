export function rasterToGrid(imageData, threshold) {
  const { width, height, data } = imageData;
  const grid = Array.from({ length: height }, () => new Array(width));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx],
        g = data[idx + 1],
        b = data[idx + 2];
      const gray = (r + g + b) / 3;
      grid[y][x] = gray > threshold;
    }
  }
  return grid;
}

export function bfs(grid, start, end) {
  const H = grid.length,
    W = grid[0].length;
  const prev = Array.from({ length: H }, () => Array(W).fill(null));
  const seen = Array.from({ length: H }, () => Array(W).fill(false));
  let visited = 0;
  const q = [start];
  seen[start.y][start.x] = true;
  visited++;

  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  while (q.length) {
    const cur = q.shift();
    if (cur.x === end.x && cur.y === end.y) {
      return { prev, visited };
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx,
        ny = cur.y + dy;
      if (
        nx >= 0 &&
        nx < W &&
        ny >= 0 &&
        ny < H &&
        !seen[ny][nx] &&
        grid[ny][nx]
      ) {
        seen[ny][nx] = true;
        visited++;
        prev[ny][nx] = cur;
        q.push({ x: nx, y: ny });
      }
    }
  }
  return { prev: null, visited };
}
