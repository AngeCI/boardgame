"use strict";

let ChessSprites = {};
let ChessSpritesImageBitmap = {};
const ChessSpritesMap = ["wK", "wQ", "wB", "wN", "wR", "wP", "bK", "bQ", "bB", "bN", "bR", "bP"];

(async () => {
  const svgDocument = new DOMParser().parseFromString(await (await fetch("img/Chess_Pieces_Sprite.svg")).text(), "image/svg+xml");
  const allGroups = svgDocument.querySelectorAll("svg > g");

  for (let i = 0; i < allGroups.length; i++) {
    const clonedG = allGroups[i].cloneNode(true);
    clonedG.removeAttribute("transform");

    const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    newSvg.setAttribute("viewBox", "0 0 45 45");
    newSvg.setAttribute("width", "80%");
    newSvg.setAttribute("height", "80%");
    newSvg.appendChild(clonedG);
    ChessSprites[ChessSpritesMap[i]] = newSvg;
  };

  const spriteImg = new Image(600, 200);
  spriteImg.src = "img/Chess_Pieces_Sprite.svg";
  spriteImg.onload = async () => {
    ChessSpritesImageBitmap.wK = await createImageBitmap(spriteImg, 0, 0, 100, 100);
    ChessSpritesImageBitmap.wQ = await createImageBitmap(spriteImg, 100, 0, 100, 100);
    ChessSpritesImageBitmap.wB = await createImageBitmap(spriteImg, 200, 0, 100, 100);
    ChessSpritesImageBitmap.wN = await createImageBitmap(spriteImg, 300, 0, 100, 100);
    ChessSpritesImageBitmap.wR = await createImageBitmap(spriteImg, 400, 0, 100, 100);
    ChessSpritesImageBitmap.wP = await createImageBitmap(spriteImg, 500, 0, 100, 100);
    ChessSpritesImageBitmap.bK = await createImageBitmap(spriteImg, 0, 100, 100, 100);
    ChessSpritesImageBitmap.bQ = await createImageBitmap(spriteImg, 100, 100, 100, 100);
    ChessSpritesImageBitmap.bB = await createImageBitmap(spriteImg, 200, 100, 100, 100);
    ChessSpritesImageBitmap.bN = await createImageBitmap(spriteImg, 300, 100, 100, 100);
    ChessSpritesImageBitmap.bR = await createImageBitmap(spriteImg, 400, 100, 100, 100);
    ChessSpritesImageBitmap.bP = await createImageBitmap(spriteImg, 500, 100, 100, 100);
  };
})();

let Board = class {
  #squares = new Uint8Array(64);
  #cnv = new OffscreenCanvas(800, 800);
  #ctx; // #ctx = #cnv.getContext("2d");

  isWhiteToMove;
  plyCount;
  moves;

  // Piece lists
  #pieceLists = [];
  #whiteKings = [];
  #whiteQueens = [];
  #whiteRooks = [];
  #whiteKnights = [];
  #whiteBishops = [];
  #whitePawns = [];
  #blackKings = [];
  #blackQueens = [];
  #blackRooks = [];
  #blackKnights = [];
  #blackBishops = [];
  #blackPawns = [];

  // Bitboards
  pieceBitboards;
  colourBitboards;
  allPiecesBitboard;
  FriendlyOrthogonalSliders;
  FriendlyDiagonalSliders;
  EnemyOrthogonalSliders;
  EnemyDiagonalSliders;

  constructor() {
    this.#ctx = this.#cnv.getContext("2d");
    this.moves = [];
    this.plyCount = 0;
  };

  redrawCanvas(sprites = ChessSpritesImageBitmap) {
    const colours = ["#f1d9c0", "#a97a65"];
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    let pieceNum;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        this.#ctx.fillStyle = colours[(y ^ x) & 1];
        this.#ctx.fillRect(x * 100, y * 100, 100, 100);

        pieceNum = this.#squares[(y << 3) + x] - 8;
        let sprite = sprites[labels[pieceNum]];
        if (sprite) {
          this.#ctx.drawImage(sprite, x * 100, y * 100, 100, 100);
        };
      };
    };
  };
  refreshPieceList() {
    /*
    const pieceListTable = [
      null, null, null, null, null, null, null, null,
      null, this.#whiteKing, this.#whiteQueen, this.#whiteRook, this.#whiteKnight, this.#whiteBishop, this.#whitePawn, null,
      null, this.#blackKing, this.#blackQueen, this.#blackRook, this.#blackKnight, this.#blackBishop, this.#blackPawn, null,
    ];
    let i = 0;
    for (const piece of this.#squares) {
      pieceListTable[piece]?.push(i);
      i++;
    };
    */
  };
  importFromFen(fen) {
    this.#squares.fill(0, 0);
    const pieceTypeTable = {
      "k": Piece.KING,
      "q": Piece.QUEEN,
      "r": Piece.ROOK,
      "n": Piece.KNIGHT,
      "b": Piece.BISHOP,
      "p": Piece.PAWN
    };

    const [board, moveSide, , , , plyCount] = fen.split(" ");
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
          this.#squares[(rank << 3) + file] = pieceType | pieceColour;
          file++;
        };
      };
    };

    this.isWhiteToMove = !(moveSide == "b");
    this.plyCount = parseInt(plyCount) - 1;

    this.redrawCanvas();
    this.refreshPieceList();
  };
  importFromBase64(str) {
    const binArray = atob(str);
    for (let i = 0; i < binArray.length; i++) {
      let a = binArray.charCodeAt(i);
      for (let j = 0; j < 2; j++) {
        const nibble = (a & 0xf0) >> 4;
        this.#squares[i << 1 | j] = nibble + ((nibble > 0) << 3);
        a <<= 4;
      };
    };

    this.redrawCanvas();
    this.refreshPieceList();
  };
  toString() {
    const pieceTable = " 1234567.KQRNBP..kqrnbp.";
    const rowMargin = "+---+---+---+---+---+---+---+---+\n";
    let output = rowMargin;

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        output += `| ${pieceTable[this.#squares[(i << 3) + j]]} `;
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
        let piece = this.#squares[(i << 3) + j];
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

    return `${output} ${this.isWhiteToMove} - - 0 ${this.plyCount + 1}`;
  };
  toBase64String() {
    let arr = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      const s1 = this.#squares[i << 1];
      const s2 = this.#squares[i << 1 | 1];

      const high = s1 - ((s1 > 0) << 3);
      const low = s2 - ((s2 > 0) << 3);

      arr[i] = (high << 4) | low;
    };
    return btoa(String.fromCharCode.apply(null, arr)).slice(0, -1); // remove the trailing '='
  };
  getPiece(square) {
    return this.#squares[square];
  };
  getPieceList(pieceType, color) {
    color = (color >> 3) - 1;
    switch (pieceType) {
      case Piece.KING:
        return color ? this.#blackKings : this.#whiteKings;
        break;
      case Piece.QUEEN:
        return color ? this.#blackQueens : this.#whiteQueens;
        break;
      case Piece.ROOK:
        return color ? this.#blackRooks : this.#whiteRooks;
        break;
      case Piece.KNIGHT:
        return color ? this.#blackKnights : this.#whiteKnights;
        break;
      case Piece.BISHOP:
        return color ? this.#blackBishops : this.#whiteBishops;
        break;
      case Piece.PAWN:
        return color ? this.#blackPawns : this.#whitePawns;
        break;
      default:
        throw new TypeError();
        break;
    };
  };
  getAllPieceLists() {
    return {
      "king": [this.#whiteKings, this.#blackKings],
      "queen": [this.#whiteQueens, this.#blackQueens],
      "rook": [this.#whiteRooks, this.#blackRooks],
      "knight": [this.#whiteKnights, this.#blackKnights],
      "bishop": [this.#whiteBishops, this.#blackBishops],
      "pawn": [this.#whitePawns, this.#blackPawns]
    };
  };
  getPieceBitboard(type, isWhite) {
    
  };
  drawBoard(boardEl, rotated = false, sprites = ChessSprites) {
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    const boardRows = boardEl.children;
    let boardGrids, pieceNum;

    for (let i = 0; i < 8; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 8; j++) {
        boardGrids[j].innerHTML = "";
        pieceNum = this.#squares[rotated ? (63 - (i << 3) - j) : ((i << 3) + j)] - 8;
        let sprite = sprites[labels[pieceNum]];
        if (sprite) {
          boardGrids[j].appendChild(sprite.cloneNode(true));
        };
      };
    };
  };
  drawTextualBoard(boardEl, rotated = false) {
    const labels = " KQRNBPX";
    const boardRows = boardEl.children;
    let boardGrids, pieceNum, pieceType, pieceColor;

    for (let i = 0; i < 8; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 8; j++) {
        pieceNum = this.#squares[rotated ? (63 - (i << 3) - j) : ((i << 3) + j)];
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
  makeMove(move) {

  };
  undoMove(move) {

  };
  setPiece(index, newPiece) {
    this.#squares[index] = newPiece;
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
    return (44 >> (piece & 7)) & 1;
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

/*
const BitboardHelperObj = await WebAssembly.instantiateStreaming(fetch("data:application/wasm;base64,"));
const BitboardHelper = {
  "genPawnMoves": BitboardHelperObj.instance.exports.a,
  "genKnightMoves": BitboardHelperObj.instance.exports.b,
  "genKingMoves": BitboardHelperObj.instance.exports.c,
  "genSliderMoves": BitboardHelperObj.instance.exports.d,
  "setSquare": BitboardHelperObj.instance.exports.e,
  "clearSquare": BitboardHelperObj.instance.exports.f,
  "toggleSquare": BitboardHelperObj.instance.exports.h,
  "squareIsSet": BitboardHelperObj.instance.exports.i,
  "clearAndGetIndexOfLSB": BitboardHelperObj.instance.exports.j,
  "getNumberOfSetBits": BitboardHelperObj.instance.exports.k
};
*/
