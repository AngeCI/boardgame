"use strict";

let CChessSprites = {};
let CChessSpritesImageBitmap = {};
const CChessSpritesMap = ["rK", "rA", "rB", "rN", "rR", "rC", "rP", "bK", "bA", "bB", "bN", "bR", "bC", "bP"];

(async () => {
  const svgDocument = new DOMParser().parseFromString(await (await fetch("img/cchess_pieces_sprite.svg")).text(), "image/svg+xml");
  const allGroups = svgDocument.querySelectorAll("svg > g");

  for (let i = 0; i < allGroups.length; i++) {
    const clonedG = allGroups[i].cloneNode(true);
    clonedG.removeAttribute("transform");

    const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    newSvg.setAttribute("viewBox", "0 0 100 100");
    newSvg.setAttribute("width", "80%");
    newSvg.setAttribute("height", "80%");
    newSvg.appendChild(clonedG);
    CChessSprites[CChessSpritesMap[i]] = newSvg;
  };

  const spriteImg = new Image(700, 200);
  spriteImg.src = "img/cchess_pieces_sprite.svg";
  spriteImg.onload = async () => {
    CChessSpritesImageBitmap.rK = await createImageBitmap(spriteImg, 0, 0, 100, 100);
    CChessSpritesImageBitmap.rA = await createImageBitmap(spriteImg, 100, 0, 100, 100);
    CChessSpritesImageBitmap.rB = await createImageBitmap(spriteImg, 200, 0, 100, 100);
    CChessSpritesImageBitmap.rN = await createImageBitmap(spriteImg, 300, 0, 100, 100);
    CChessSpritesImageBitmap.rR = await createImageBitmap(spriteImg, 400, 0, 100, 100);
    CChessSpritesImageBitmap.rC = await createImageBitmap(spriteImg, 500, 0, 100, 100);
    CChessSpritesImageBitmap.rP = await createImageBitmap(spriteImg, 600, 0, 100, 100);
    CChessSpritesImageBitmap.bK = await createImageBitmap(spriteImg, 0, 100, 100, 100);
    CChessSpritesImageBitmap.bA = await createImageBitmap(spriteImg, 100, 100, 100, 100);
    CChessSpritesImageBitmap.bB = await createImageBitmap(spriteImg, 200, 100, 100, 100);
    CChessSpritesImageBitmap.bN = await createImageBitmap(spriteImg, 300, 100, 100, 100);
    CChessSpritesImageBitmap.bR = await createImageBitmap(spriteImg, 400, 100, 100, 100);
    CChessSpritesImageBitmap.bC = await createImageBitmap(spriteImg, 500, 100, 100, 100);
    CChessSpritesImageBitmap.bP = await createImageBitmap(spriteImg, 600, 100, 100, 100);
  };
})();

const boardBackgroundImg = new Image();
boardBackgroundImg.src = "img/cchess_board.svg";

let Board = class {
  #squares = new Uint8Array(256);
  #cnv = new OffscreenCanvas(900, 1200);
  #ctx; // #ctx = #cnv.getContext("2d");
  #RANK_TOP = 3;
  #RANK_BOTTOM = 12;
  #FILE_LEFT = 3;
  #FILE_RIGHT = 11;

  constructor() {
    this.#ctx = this.#cnv.getContext("2d");
  };

  redrawCanvas(sprites = CChessSpritesImageBitmap) {
    const labels = [" ", "rK", "rA", "rB", "rN", "rR", "rC", "rP", " ", "bK", "bA", "bB", "bN", "bR", "bC", "bP"];
    let pieceNum;

    this.#ctx.drawImage(boardBackgroundImg, 0, 0, this.#cnv.width, this.#cnv.height);

    for (let y = this.#RANK_TOP; y < this.#RANK_BOTTOM + 1; y++) {
      for (let x = this.#FILE_LEFT; x < this.#FILE_RIGHT + 1; x++) {
        pieceNum = this.#squares[y * 9 + x] - 8;
        let sprite = sprites[labels[pieceNum]];
        if (sprite) {
          this.#ctx.drawImage(sprite, x * 100, y * 100, 100, 100);
        };
      };
    };
  };
  convert90to256(num) {
    const row = num * 7282 >>> 16; // Math.floor(num / 9)
    const column = (num * 7282 & 0xffff) * 9 >>> 16; // num % 9
    return (row + 3 << 4) + column + 3;
  };
  convert256to90(num) {
    return ((num & 240) - 3) * 9 + (num & 15) - 3;
  };
  importFromFen(fen) {
    this.#squares.fill(0, 0);
    const pieceTypeTable = {
      "k": Piece.KING,
      "a": Piece.ADVISOR,
      "b": Piece.BISHOP,
      "n": Piece.KNIGHT,
      "r": Piece.ROOK,
      "c": Piece.CANNON,
      "p": Piece.PAWN
    };

    const board = fen.split(" ")[0];
    let file = 0, rank = 0;
    for (let symbol of board) {
      if (symbol == "/") {
        file = 0;
        rank++;
      } else {
        if (!isNaN(parseInt(symbol))) {
          file += parseInt(symbol);
        } else {
          let pieceColour = symbol.charCodeAt(0) < 96 ? Piece.WHITE : Piece.BLACK;
          let pieceType = pieceTypeTable[symbol.toLowerCase()];
          this.#squares[this.convert90to256(rank * 9 + file)] = pieceType | pieceColour;
          file++;
        };
      };
    };

    this.redrawCanvas();
  };
  importFromBase64(str) {
    const binArray = atob(str);
    for (let i = 0; i < binArray.length; i++) {
      let a = binArray.charCodeAt(i);
      for (let j = 0; j < 2; j++) {
        const nibble = (a & 0xf0) >> 4;
        this.#squares[this.convert90to256(i << 1 | j)] = nibble + ((nibble > 0) << 3);
        a <<= 4;
      };
    };

    this.redrawCanvas();
  };
  toString() {
    const pieceTable = " 1234567.KABNRCP.kabnrcp";
    const rowMargin = "+---+---+---+---+---+---+---+---+---+\n";
    let output = rowMargin;

    for (let i = this.#RANK_TOP; i < this.#RANK_BOTTOM + 1; i++) {
      for (let j = this.#FILE_LEFT; j < this.#FILE_RIGHT + 1; j++) {
        output += `| ${pieceTable[this.#squares[i * 9 + j]]} `;
      };

      output += `| ${10 - i}\n`;
      output += rowMargin;
    };;

    return output + "  9   8   7   6   5   4   3   2   1  ";
  };
  getFENString() {
    const pieceTable = " 1234567.KABNRCP.kabnrcp";
    let output = "";
    let emptySquareCounter = 0;

    for (let i = this.#RANK_TOP; i < this.#RANK_BOTTOM + 1; i++) {
      for (let j = this.#FILE_LEFT; j < this.#FILE_RIGHT + 1; j++) {
        let piece = this.#squares[i * 9 + j];
        if (piece != 0) {
          if (emptySquareCounter > 0) {
            output += emptySquareCounter;
            emptySquareCounter = 0;
          };
          output += pieceTable[piece];
        } else {
          emptySquareCounter++;
        };
      };

        if (emptySquareCounter != 0) {
          output += emptySquareCounter;
          emptySquareCounter = 0;
        };

      if (i < this.#FILE_RIGHT)
        output += "/";
    };

    return output;
  };
  toBase64String() {
    let arr = new Uint8Array(45);
    for (let i = 0; i < 45; i++) {
      const s1 = this.#squares[this.convert90to256(i << 1)];
      const s2 = this.#squares[this.convert90to256(i << 1 | 1)];

      const high = s1 - ((s1 > 0) << 3);
      const low = s2 - ((s2 > 0) << 3);

      arr[i] = (high << 4) | low;
    };
    return btoa(String.fromCharCode.apply(null, arr));
  };
  drawBoard(boardEl, sprites = CChessSprites) {
    const labels = [" ", "rK", "rA", "rB", "rN", "rR", "rC", "rP", " ", "bK", "bA", "bB", "bN", "bR", "bC", "bP"];
    const boardRows = boardEl.children;
    let boardGrids, pieceNum;

    for (let i = 0; i < 10; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 9; j++) {
        boardGrids[j].innerHTML = "";
        pieceNum = this.#squares[this.convert90to256(i * 9 + j)] - 8;
        let sprite = sprites[labels[pieceNum]];
        if (sprite) {
          boardGrids[j].appendChild(sprite.cloneNode(true));
        };
      };
    };
  };
  drawTextualBoard(boardEl) {
    const labels = " KABNRCP";
    const boardRows = boardEl.children;
    let boardGrids, pieceNum, pieceType, pieceColor;

    for (let i = 0; i < 10; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 9; j++) {
        pieceNum = this.#squares[this.convert90to256(i * 9 + j)];
        pieceType = pieceNum & 7;
        pieceColor = ((pieceNum >> 3) & 3) - 1;
        boardGrids[j].innerText = labels[pieceType];
        if (pieceColor) {
          boardGrids[j].classList.remove("chess-white");
          boardGrids[j].classList.add("chess-black");
        } else {
          boardGrids[j].classList.remove("chess-black");
          boardGrids[j].classList.add("chess-white");
        };
      };
    };
  };
  getImage() {
     return this.#cnv.convertToBlob();
  };
};

let Piece = {
  "NONE": 0,
  "KING": 1,
  "ADVISOR": 2,
  "BISHOP": 3,
  "KNIGHT": 4,
  "ROOK": 5,
  "CANNON": 6,
  "PAWN": 7,

  "WHITE": 8,
  "BLACK": 16,

  "isColour": function (piece) {
    return piece >> 3;
  }
};
