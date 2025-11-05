"use strict";

HTMLCanvasElement.prototype.getBlob = async function (type = "image/png") {
  return new Promise((resolve, reject) => {
    this.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error(`Fail to get blob from canvas: ${this}.`));
      };
    }, type);
  });
};

const board = document.querySelector(".go-board-coord");
const cnv = document.querySelector("canvas");
const ctx = cnv.getContext("2d");
let currentPlayer = false; // 0 = black, 1 = white
let lastPosition = "00";

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

  ctx.fillStyle = "#f1b060";
  ctx.fillRect(0, 0, 560, 560);

  ctx.fillStyle = "#805030";
  ctx.strokeStyle = "#ad7643";
  ctx.font = "bold 16px sans-serif";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 19; i++) {
    ctx.fillText(String.fromCharCode(i + 65), i * 28 + 37, 551);
    ctx.fillText(i + 1, 10, 523 - i * 28);

    ctx.moveTo(42, 518 - i * 28);
    ctx.lineTo(547, 518 - i * 28);
    ctx.moveTo(42 + i * 28, 13);
    ctx.lineTo(42 + i * 28, 518);
  };
  ctx.stroke();

  /*
  ctx.beginPath();
  ctx.ellipse(126, 98, 5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(294, 98, 5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(462, 98, 5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(126, 266, 5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(294, 266, 5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(462, 266, 5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(126, 434, 5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(294, 434, 5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(462, 434, 5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  */
  const starX = [126, 294, 462], starY = [98, 266, 434];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      ctx.ellipse(starX[i], starY[j], 5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    };
  };

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
  const blob = await cnv.getBlob();
  await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);
};

document.getElementById("capture-btn").addEventListener("click", captureImage);

initializedBoard();
