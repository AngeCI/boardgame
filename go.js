"use strict";

const board = document.querySelector(".go-board-coord");
const cnv = new OffscreenCanvas(560, 560);
const ctx = cnv.getContext("2d", { alpha: false, willReadFrequently: true });
const TwoPI = 6.283185307179586;
let currentPlayer = false; // 0 = black, 1 = white
let lastPosition = "00";
let boardObj;

ctx.init = function (size) {
  const sizePx = 28 * (size + 1);
  this.canvas.width = sizePx;
  this.canvas.height = sizePx;

  this.fillStyle = "#f1b060";
  this.fillRect(0, 0, sizePx, sizePx);

  this.fillStyle = "#805030";
  this.strokeStyle = "#ad7643";
  this.font = "bold 16px sans-serif";
  this.textAlign = "center";
  this.lineWidth = 2;
  this.beginPath();
  for (let i = 0; i < size; i++) {
    this.fillText(String.fromCharCode(i + 65), 42 + i * 28, size * 28 + 19);
    this.fillText(i + 1, 14, (size - i) * 28 - 9);

    this.moveTo(42, (size - i) * 28 - 14);
    this.lineTo(size * 28 + 15, (size - i) * 28 - 14);
    this.moveTo(42 + i * 28, 13);
    this.lineTo(42 + i * 28, size * 28 - 14);
  };
  this.stroke();

  if (size == 19) {
    const starX = [126, 294, 462], starY = [98, 266, 434];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        this.beginPath();
        this.ellipse(starX[i], starY[j], 5, 5, 0, 0, TwoPI);
        this.fill();
      };
    };
  } else if (size == 15) {
    const starX = [126, 350], starY = [98, 322];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        this.beginPath();
        this.ellipse(starX[i], starY[j], 5, 5, 0, 0, TwoPI);
        this.fill();
      };
    };
    this.beginPath();
    this.ellipse(238, 210, 5, 5, 0, 0, TwoPI);
    this.fill();
  } else if (size == 9) {
    const starX = [98, 210], starY = [70, 182];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        this.beginPath();
        this.ellipse(starX[i], starY[j], 5, 5, 0, 0, TwoPI);
        this.fill();
      };
    };
  };
};

ctx.addPiece = function (x, y, color) {
  this.fillStyle = color ? "#ffffff" : "#303030";
  this.beginPath();
  this.ellipse(42 + x * 28, 14 + y * 28, 13, 13, 0, 0, TwoPI);
  this.fill();

  // Draw black border around white pieces
  if (color) {
    this.strokeStyle = "#303030";
    this.lineWidth = 1.3;
    this.beginPath();
    this.ellipse(42 + x * 28, 14 + y * 28, 13, 13, 0, 0, TwoPI);
    this.stroke();
  };
};

ctx.setLastMoveMarker = function (x, y, oldX, oldY) {
  ctx.fillStyle = "#ff0000";
  ctx.beginPath();
  ctx.ellipse(42 + x * 28, 14 + y * 28, 7, 7, 0, 0, TwoPI);
  ctx.fill();

  // Remove last move indicator
  if (typeof oldX === "number" && typeof oldY === "number") {
    ctx.fillStyle = "#" + new DataView(ctx.getImageData(34 + oldX * 28, 6 + oldY * 28, 1, 1).data.buffer).getUint32().toString(16); // Get color from the old square
    ctx.beginPath();
    ctx.ellipse(42 + oldX * 28, 14 + oldY * 28, 8, 8, 0, 0, TwoPI);
    ctx.fill();
  };
};

ctx.removePiece = function (x, y, color) {
  this.fillStyle = "#f1b060";
  this.beginPath();
  this.ellipse(42 + x * 28, 14 + y * 28, 15, 15, 0, 0, TwoPI);
  this.fill();
};

let Board = class {
  koPoint;
  #boardSize;
  #board;
  capturedStones;

  constructor(size) {
    this.#boardSize = size;
    this.#board = new Uint8Array(size * size);
  };

  getColor(p) {
    return this.#board[p];
  };
  setColor(p, color) {
    this.#board[p] = color;
  };
  getNeighbors(p) {
    let neighbors = new Uint16Array(4);
    neighbors.fill(65535, 0);
    const x = p % this.#boardSize, y = Math.floor(p / this.#boardSize);

    if (x > 0)
      neighbors[0] = (p - 1); // left
    if (x < this.#boardSize - 1)
      neighbors[1] = (p + 1); // right
    if (y > 0)
      neighbors[2] = ((y - 1) * this.#boardSize + x); // up
    if (y < this.#boardSize - 1)
      neighbors[3] = ((y + 1) * this.#boardSize + x); // down

    return neighbors;
  };
  getChainPoints(p) {
    let stones = [p];

    const originalColor = this.getColor(p);
    const floodfillColor = originalColor ^ 1;
    const clone = new Board(this.#boardSize);
    clone.#board.set(this.#board);
    clone.setColor(p, floodfillColor);

    const neighbors = clone.getNeighbors(p);
    for (const neighbor of neighbors) {
      if (neighbor === 65535) continue;
      if (clone.getColor(neighbor) === originalColor) {
        if (stones.indexOf(neighbor) == -1) {
          stones.push(...this.getChainPoints(neighbor));
        };
      }
    };

    return stones;
  };
  getChain(p) {
    const stones = this.getChainPoints(p);
    let liberties = [];

    for (const stone of stones) {
      for (const point of this.getNeighbors(stone)) {
        if (this.getColor(point) === 0) {
          liberties.push(point);
        };
      };
    };

    return {
      stones: stones,
      liberties: liberties
    };
  };
  inAtari(p) {
    return this.getChain(p).liberties.length === 1;
  };
  isLegal(p, color) {
    // Is the point already occupied?
    if (this.getColor(p) !== 0) {
      return false;
    };
    // Is the move ko?
    if (p === this.koPoint) {
      return false;
    };
    // Is the move suicide?
    let suicide = true;
    for (const neighbor of this.getNeighbors(p)) {
      if (neighbor === 65535) continue;
      if (getColor(neighbor) === 0) {
        // if any neighbor is empty, it's not a suicide
        suicide = false;
        break;
      } else if (getColor(neighbor) === color) {
        // if any neighbor is an ally that isn't in atari
        if (!inAtari(neighbor)) {
          suicide = false;
          break;
        };
      } else if (getColor(neighbor) === color ^ 1) {
        // if any neighbor is an enemy AND that enemy is in atari
        if (inAtari(neighbor)) {
          suicide = false;
          break;
        };
      };
    };
    if (suicide) {
      return false;
    };

    return true;
  };
  performMove(p, color) {
    if (isLegal(p, color)) {
      this.setColor(p, color);

      // can capture?
      for (const neighbor of this.getNeighbors(p)) {
        if (getColor(neighbor) === color ^ 1) {
          // if any neighbor is an enemy AND that enemy is in atari
          if (inAtari(neighbor)) {
            // remove the enemy stones from the board
            for (const point of this.getChain(neighbor).stones) {
              this.setColor(point, 0);
              this.capturedStones.push(point);
            };
          };
        };
      };

      // If this move captured exactly one stone, that stone is the new ko point
      if (this.capturedStones.length === 1) {
        this.koPoint = this.capturedStones[0];
      } else {
        this.koPoint = null;
      };
    } else {
      throw new Error(`The specified move (${p}, ${color}) is illegal.`);
    };
  };
  toString() {
    const pieceTable = "..●○";
    let output = "";

    for (let i = 0; i < this.#boardSize; i++) {
      for (let j = 0; j < this.#boardSize; j++) {
        output += pieceTable[this.#board[i * this.#boardSize + j]];
      };

      output += "\n";
    };

    return output;
  };
};

let boardInputListener = function (ev) {
  const el = ev.target;
  el.setAttribute("data-bw", currentPlayer ? "w" : "b");

  const size = parseInt(document.getElementById("board-size").value);
  const coords = el.getAttribute("data-xy");
  if (coords != "00") {
    el.removeEventListener("click", boardInputListener);
    document.querySelector("table.go-board-coord td[data-xy='00']").setAttribute("data-bw", "");

    const coordX = coords.charCodeAt(0) - 65, coordY = 64 + size - coords.charCodeAt(1);
    ctx.addPiece(coordX, coordY, currentPlayer);
    ctx.setLastMoveMarker(coordX, coordY, lastPosition.charCodeAt(0) - 65, 64 + size - lastPosition.charCodeAt(1));

    boardObj.setColor(coordY * size + coordX, currentPlayer + 2);

    // Update scores
    let scoreEl = document.getElementById(`score-${currentPlayer ? "white" : "black"}`);
    let oppScore = parseInt(document.getElementById(`score-${currentPlayer ? "black" : "white"}`).textContent);
    let score = parseInt(scoreEl.textContent);
    // scoreEl.textContent = score++;
    score++;
    scoreEl.textContent = score;
    document.getElementById("score-pts").textContent = currentPlayer ? oppScore - score : score - oppScore;
  };

  currentPlayer = !currentPlayer;

  document.querySelector(`table.go-board-coord td[data-xy='${lastPosition}']`).textContent = "";
  lastPosition = el.getAttribute("data-xy");
  el.textContent = "●";
};

let createTable = function (rows, columns) {
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");

  for (let i = 0; i < rows; i++) {
    let tr = document.createElement("tr");
    for (let j = 0; j < columns; j++) {
      tr.appendChild(document.createElement("td"));
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
};

let initializedBoard = function () {
  const size = parseInt(document.getElementById("board-size").value);
  // board.innerHTML = createTable(size, size).children[0].outerHTML;

  for (const tr of board.children[0].children) {
    for (const td of tr.children) {
      if (td.getAttribute("data-xy")) {
        td.textContent = "";
        td.setAttribute("data-bw", "");
        td.addEventListener("click", boardInputListener);
      };
    };
  };

  ctx.init(size);

  boardObj = new Board(size);

  document.getElementById("score-black").textContent = 0;
  document.getElementById("score-white").textContent = 0;
  document.getElementById("score-pts").textContent = 0;

  currentPlayer = false;
  lastPosition = "00";
};

document.getElementById("reset-btn").addEventListener("click", initializedBoard);

let saveFile = (blob, filename = "") => {
  const a = document.createElement("a");
  a.download = filename;
  a.href = URL.createObjectURL(blob);
  a.addEventListener("click", () => {
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  });
  a.click();
};

let captureImage = async function () {
  const blob = await cnv.convertToBlob();
  await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);

  document.getElementById("image-capture-popup").classList.toggle("show");
  setTimeout(() => {
    document.getElementById("image-capture-popup").classList.toggle("show");
  }, 5000);
};

document.getElementById("capture-btn").addEventListener("click", captureImage);

initializedBoard();
