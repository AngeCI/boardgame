"use strict";

const board = document.querySelector(".go-board-coord");
const cnv = new OffscreenCanvas(448, 448);
const ctx = cnv.getContext("2d");
let currentPlayer = false; // 0 = black, 1 = white
let lastPosition = "00";

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
    ctx.fillStyle = currentPlayer ? "#ffffff" : "#303030";
    ctx.beginPath();
    ctx.ellipse(42 + coordX * 28, 14 + coordY * 28, 13, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw black border around white pieces
    if (currentPlayer) {
      ctx.strokeStyle = "#303030";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(42 + coordX * 28, 14 + coordY * 28, 13, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
    };

    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.ellipse(42 + coordX * 28, 14 + coordY * 28, 7, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Remove last move indicator
    ctx.fillStyle = currentPlayer ? "#303030" : "#ffffff";
    ctx.beginPath();
    ctx.ellipse(42 + (lastPosition.charCodeAt(0) - 65) * 28, 14 + (79 - lastPosition.charCodeAt(1)) * 28, 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
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

  ctx.fillStyle = "#f1b060";
  ctx.fillRect(0, 0, 448, 448);

  ctx.fillStyle = "#805030";
  ctx.strokeStyle = "#ad7643";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 15; i++) {
    ctx.fillText(String.fromCharCode(i + 65), 42 + i * 28, 439);
    ctx.fillText(i + 1, 14, 411 - i * 28);

    ctx.moveTo(42, 406 - i * 28);
    ctx.lineTo(435, 406 - i * 28);
    ctx.moveTo(42 + i * 28, 13);
    ctx.lineTo(42 + i * 28, 406);
  };
  ctx.stroke();

  const starX = [126, 350], starY = [98, 322];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.ellipse(starX[i], starY[j], 5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    };
  };
  ctx.beginPath();
  ctx.ellipse(238, 210, 5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

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
