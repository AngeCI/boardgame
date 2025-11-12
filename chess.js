"use strict";

let ChessSprites = {};
let ChessSpritesImageBitmap = {};
const ChessSpritesMap = ["wK", "wQ", "wB", "wN", "wR", "wP", "bK", "bQ", "bB", "bN", "bR", "bP"];

(async () => {
  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(await (await fetch("img/Chess_Pieces_Sprite.svg")).text(), "image/svg+xml");
  const allGroups = svgDocument.querySelectorAll("svg > g");

  for (let i = 0; i < allGroups.length; i++) {
    const clonedG = allGroups[i].cloneNode(true);
    clonedG.removeAttribute("transform");

    const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    newSvg.setAttribute("viewBox", "0 0 45 45");
    newSvg.setAttribute("width", "100%");
    newSvg.setAttribute("height", "100%");
    newSvg.appendChild(clonedG);
    ChessSprites[ChessSpritesMap[i]] = newSvg;
  };

  const spriteImg = new Image();
  spriteImg.src = "img/Chess_Pieces_Sprite.svg";
  spriteImg.onload = async () => {
    ChessSpritesImageBitmap.wK = await createImageBitmap(spriteImg, 0, 0, 45, 45);
    ChessSpritesImageBitmap.wQ = await createImageBitmap(spriteImg, 45, 0, 45, 45);
    ChessSpritesImageBitmap.wB = await createImageBitmap(spriteImg, 90, 0, 45, 45);
    ChessSpritesImageBitmap.wN = await createImageBitmap(spriteImg, 135, 0, 45, 45);
    ChessSpritesImageBitmap.wR = await createImageBitmap(spriteImg, 180, 0, 45, 45);
    ChessSpritesImageBitmap.wP = await createImageBitmap(spriteImg, 225, 0, 45, 45);
    ChessSpritesImageBitmap.bK = await createImageBitmap(spriteImg, 0, 45, 45, 45);
    ChessSpritesImageBitmap.bQ = await createImageBitmap(spriteImg, 45, 45, 45, 45);
    ChessSpritesImageBitmap.bB = await createImageBitmap(spriteImg, 90, 45, 45, 45);
    ChessSpritesImageBitmap.bN = await createImageBitmap(spriteImg, 135, 45, 45, 45);
    ChessSpritesImageBitmap.bR = await createImageBitmap(spriteImg, 180, 45, 45, 45);
    ChessSpritesImageBitmap.bP = await createImageBitmap(spriteImg, 225, 45, 45, 45);
  };
})();

let Board = class {
  squares = new Uint8Array(64);
  cnv = new OffscreenCanvas(800, 800);
  ctx; // ctx = cnv.getContext("2d");

  constructor() {
    this.ctx = this.cnv.getContext("2d");
  };

  redrawCanvas(sprites = ChessSpritesImageBitmap) {
    const colours = ["#f1d9c0", "#a97a65"];
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    let pieceNum;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        this.ctx.fillStyle = colours[(y ^ x) & 1];
        this.ctx.fillRect(x * 100, y * 100, 100, 100);

        pieceNum = this.squares[(y << 3) + x] - 8;
        let sprite = sprites[labels[pieceNum]];
        if (sprite) {
          this.ctx.drawImage(sprite, x * 100, y * 100, 100, 100);
        };
      };
    };
  };
  importFromFen(fen) {
    this.squares.fill(0, 0);
    const pieceTypeTable = {
      "k" : Piece.KING,
      "q" : Piece.QUEEN,
      "r" : Piece.ROOK,
      "n" : Piece.KNIGHT,
      "b" : Piece.BISHOP,
      "p" : Piece.PAWN
    };

    const board = fen.split(" ")[0];
    let file = 0, rank = 0;
    for (let symbol in board) {
      symbol = board[symbol];
      if (symbol == "/") {
        file = 0;
        rank++;
      } else {
        if (!isNaN(parseInt(symbol))) {
          file += parseInt(symbol);
        } else {
          let pieceColour = symbol.charCodeAt(0) < 96 ? Piece.WHITE : Piece.BLACK;
          let pieceType = pieceTypeTable[symbol.toLowerCase()];
          this.squares[(rank << 3) + file] = pieceType | pieceColour;
          file++;
        };
      };
    };

    this.redrawCanvas();
  };
  importFromBase64(str) {
    const binArray = atob(str);
    for (let i = 0; i < binArray.length; i++) {
        let a = str.charCodeAt(i);
        for (let j = 0; j < 2; j++) {
            this.squares[i << 1 | j] = ((a & 0xf0) >> 4) + 8;
            a <<= 4;
        }
    };

    this.redrawCanvas();
  };
  toString() {
    const pieceTable = " 1234567.KQRNBP..kqrnbp.";
    const rowMargin = "+---+---+---+---+---+---+---+---+\n";
    let output = rowMargin;

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        output += `| ${pieceTable[this.squares[(i << 3) + j]]} `;
      };

      output += `| ${8 - i}\n`;
      output += rowMargin;
    };;

    return output + "  a   b   c   d   e   f   g   h  ";
  };
  getFENString() {
    const pieceTable = " 1234567.KQRNBP..kqrnbp.";
    let output = "";
    let emptySquareCounter = 0;

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        let piece = this.squares[(i << 3) + j];
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

      if (i < 7)
        output += "/";
    };

    return output;
  };
  toBase64String() {
    let arr = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      arr[i] = (this.squares[i << 1] << 4) + this.squares[i << 1 | 1] - 136;
    };
    return btoa(Array.from(arr, (b) => String.fromCodePoint(b)).join(""));
  };
  getPieceBitboard(type, isWhite) {
    
  };
  drawBoard(boardEl, sprites = ChessSprites) {
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    const boardRows = boardEl.children;
    let boardGrids, pieceNum;

    for (let i = 0; i < 8; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 8; j++) {
        boardGrids[j].innerHTML = "";
        pieceNum = this.squares[(i << 3) + j] - 8;
        let sprite = sprites[labels[pieceNum]];
        if (sprite) {
          boardGrids[j].appendChild(sprite.cloneNode(true));
        };
      };
    };
  };
  drawTextualBoard(boardEl) {
    const labels = " KQRNBPX";
    const boardRows = boardEl.children;
    let boardGrids, pieceNum, pieceType, pieceColor;

    for (let i = 0; i < 8; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 8; j++) {
        pieceNum = this.squares[(i << 3) + j];
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
     return this.cnv.convertToBlob();
  };
  whitePiecesBitboard;
  blackPiecesBitboard;
  allPiecesBitboard;
  visualizeBitboard;
};

let Piece = {
  "NONE": 0,
  "KING": 1,
  "QUEEN": 2,
  "ROOK": 3,
  "KNIGHT": 4,
  "BISHOP": 5,
  "PAWN": 6,

  "WHITE": 8,
  "BLACK": 16,

  "isSlidingPiece": function (piece) {
    return piece;
  },
  "isColour": function (piece) {
    return piece >> 3;
  }
};

let sqNumberToAlgebraic = function (n) {
  return String.fromCharCode((n & 7) + 97) + ((n >> 3) + 1);
};

let Move = class {
  moveValue;

  NO_FLAG = 0;
  EN_PASSANT_FLAG = 1;
  CASTLE_FLAG = 2;
  PAWN_DOUBLE_PUSH_FLAG = 3;
  PROMOTE_TO_QUEEN_FLAG = 4;
  PROMOTE_TO_KNIGHT_FLAG = 5;
  PROMOTE_TO_ROOK_FLAG = 6;
  PROMOTE_TO_BISHOP_FLAG = 7;

  START_SQ_MASK = 0x0003f;
  TARGET_SQ_MASK = 0x0fc00;
  FLAG_MASK = 0xf0000;

  constructor(moveValue, targetSq, flag) {
    if (!targetSq) {
      this.moveValue = moveValue;
    } else if (!flag) {
      this.moveValue = startSq | targetSq << 6;
    } else {
      this.moveValue = startSq | targetSq << 6 | flag << 12;
    };
  };

  isNull() {
    return moveValue == 0;
  };
  getStartSq() {
    return moveValue & START_SQ_MASK;
  };;
  getTargetSq() {
    return (moveValue & TARGET_SQ_MASK) >> 6;
  };
  isPromotion() {
    return moveFlag >= PROMOTE_TO_QUEEN_FLAG;
  };
  isEnPassant() {
    return moveFlag == EN_PASSANT_FLAG;
  };
  nullMove = new Move(0);
  getPromotionPieceType() {
    switch(MoveFlag) {
      case PROMOTE_TO_ROOK_FLAG:
        return Piece.ROOK;
      case PROMOTE_TO_KNIGHT_FLAG:
        return Piece.KNIGHT;
      case PROMOTE_TO_BISHOP_FLAG:
        return Piece.BISHOP;
      case PROMOTE_TO_QUEEN_FLAG:
        return Piece.QUEEN;
      default:
        return 0;
    };
  };
  isSameMove(a, b) {
    return a.moveValue == b.moveValue;
  };
  toString() {
    const promotionPiece = ".kqrnbp.";
    return sqNumberToAlgebraic(this.moveValue >> 6) + sqNumberToAlgebraic(this.moveValue & 63) + promotionPiece[this.getPromotionPieceType()];
  };
  toBase64String() {
    // const base64char = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const base64char = "456789+/wxyz0123opqrstuvghijklmnYZabcdefQRSTUVWXIJKLMNOPABCDEFGH";
    return base64char[this.getStartSq()] + base64char[this.getTargetSq()] + this.getPromotionPieceType();
  };
};

let bitboardToString = function (bitboard) {
  return bitboard.toString(2).padStart(64, "0").match(/.{8}/g).join("\n");
};
