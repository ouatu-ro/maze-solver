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
  const height = grid.length;
  const width = grid[0].length;
  const prev = Array.from({ length: height }, () => Array(width).fill(null));
  const seen = Array.from({ length: height }, () => Array(width).fill(false));
  const queue = [start];
  let visited = 0;

  seen[start.y][start.x] = true;
  visited++;

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
      let node = current;
      while (node) {
        path.push(node);
        node = prev[node.y][node.x];
      }
      return { path: path.reverse(), visited };
    }

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (
        nx >= 0 &&
        nx < width &&
        ny >= 0 &&
        ny < height &&
        !seen[ny][nx] &&
        grid[ny][nx]
      ) {
        seen[ny][nx] = true;
        visited++;
        prev[ny][nx] = current;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return { path: null, visited };
}
