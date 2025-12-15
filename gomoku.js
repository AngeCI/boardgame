"use strict";

const board = document.querySelector(".go-board-coord");
const cnv = new OffscreenCanvas(448, 448);
const ctx = cnv.getContext("2d");
const TwoPI = 6.283185307179586;
let currentPlayer = false; // 0 = black, 1 = white
let lastPosition = "00";

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

  // only works for size = 15
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
  if (oldX && oldY) {
    ctx.fillStyle = currentPlayer ? "#303030" : "#ffffff"; // Get color from the old square
    ctx.beginPath();
    ctx.ellipse(42 + oldX * 28, 14 + oldY * 28, 8, 8, 0, 0, TwoPI);
    ctx.fill();
  };
};

let hasWon = function () {
  let c;

  // Check rows
  for (let y = 0; y < 15; y++) {
    let str = "";
    for (let x = 0; x < 15; x++) {
      c = document.querySelector(`table.go-board-coord td[data-xy='${String.fromCharCode(x + 65)}${String.fromCharCode(y + 65)}']`).getAttribute("data-bw");
      if (c) str += c;
      else str += ".";
    };
    if (str.match(currentPlayer ? "bbbbb" : "wwwww")) {
      return true;
    };
  };

  // Check columns
  for (let x = 0; x < 15; x++) {
    let str = "";
    for (let y = 0; y < 15; y++) {
      c = document.querySelector(`table.go-board-coord td[data-xy='${String.fromCharCode(x + 65)}${String.fromCharCode(y + 65)}']`).getAttribute("data-bw");
      if (c) str += c;
      else str += ".";
    };
    if (str.match(currentPlayer ? "bbbbb" : "wwwww")) {
      return true;
    };
  };

  // Check diagonals
  for (let i = 0; i < 11; i++) {
    for (let j = 0; j < 11; j++) {
      let diagonal1 = "";
      let diagonal2 = "";
      for (let k = 0; k < 5; k++) {
        c = document.querySelector(`table.go-board-coord td[data-xy='${String.fromCharCode(i + k + 65)}${String.fromCharCode(j + k + 65)}']`).getAttribute("data-bw");
        if (c) diagonal1 += c;
        else diagonal1 += ".";

        c = document.querySelector(`table.go-board-coord td[data-xy='${String.fromCharCode(i - k + 69)}${String.fromCharCode(j + k + 65)}']`).getAttribute("data-bw");
        if (c) diagonal2 += c;
        else diagonal2 += ".";
      };
      if (diagonal1.match(currentPlayer ? "bbbbb" : "wwwww") || diagonal2.match(currentPlayer ? "bbbbb" : "wwwww")) {
        return true;
      };
    };
  };

  return false;

};

let boardInputListener = function (ev) {
  const el = ev.target;
  el.setAttribute("data-bw", currentPlayer ? "w" : "b");

  const coords = el.getAttribute("data-xy");
  if (coords != "00") {
    el.removeEventListener("click", boardInputListener);
    document.querySelector("table.go-board-coord td[data-xy='00']").setAttribute("data-bw", "");

    const coordX = coords.charCodeAt(0) - 65, coordY = 79 - coords.charCodeAt(1);
    ctx.addPiece(coordX, coordY, currentPlayer);

    ctx.setLastMoveMarker(coordX, coordY, lastPosition.charCodeAt(0) - 65, 79 - lastPosition.charCodeAt(1));
  };

  currentPlayer = !currentPlayer;

  document.querySelector(`table.go-board-coord td[data-xy='${lastPosition}']`).textContent = "";
  lastPosition = coords;
  el.textContent = "●";

  if (hasWon()) {
    const p = document.createElement("p");
    p.appendChild(document.createTextNode(`${currentPlayer ? "Black" : "White"} has won! Please reset the board to continue.`));
    document.body.appendChild(p);

    for (const tr of board.children[0].children) {
      for (const td of tr.children) {
        if (td.getAttribute("data-xy")) {
          td.removeEventListener("click", boardInputListener);
        };
      };
    };
  };
};

let initializedBoard = function () {
  for (const tr of board.children[0].children) {
    for (const td of tr.children) {
      if (td.getAttribute("data-xy")) {
        td.textContent = "";
        td.setAttribute("data-bw", "");
        td.addEventListener("click", boardInputListener);
      };
    };
  };

  if (document.querySelector("p"))
    document.body.removeChild(document.querySelector("p"));

  ctx.init(15);

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
