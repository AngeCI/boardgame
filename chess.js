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
})();

let Board = class {
  #squares = new Uint8Array(64);
  #cnv = new OffscreenCanvas(800, 800);
  #ctx; // #ctx = #cnv.getContext("2d");

  #cnvLightColor = "#f1d9c0";
  #cnvDarkColor = "#a97a65";

  isWhiteToMove;
  plyCount;
  moves = [];

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
  pieceBitboards = new Uint32Array();
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
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    let pieceNum;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        this.#ctx.fillStyle = ((y ^ x) & 1) ? this.#cnvDarkColor : this.#cnvLightColor;
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
    // Todo
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
      if (symbol === "/") {
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

    this.isWhiteToMove = !(moveSide === "b");
    this.plyCount = (parseInt(plyCount) - 1 << 1) + !this.isWhiteToMove;

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
        if (piece !== 0) {
          if (emptySquareCounter > 0) {
            output += emptySquareCounter;
            emptySquareCounter = 0;
          };
          output += pieceTable[piece];
        } else {
          emptySquareCounter++;
        };
      };

        if (emptySquareCounter !== 0) {
          output += emptySquareCounter;
          emptySquareCounter = 0;
        };

      if (i < 7)
        output += "/";
    };

    return `${output} ${this.isWhiteToMove ? "w" : "b"} - - 0 ${(this.plyCount >> 1) + 1}`;
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
    // Todo
  };
  drawBoard(boardEl, rotated = false, sprites = ChessSprites) {
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    const boardRows = boardEl.children;
    let boardGrids, pieceNum;

    for (let i = 0; i < 8; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 8; j++) {
        boardGrids[j].innerHTML = "";
        pieceNum = this.#squares[rotated ? ((i << 3) + j ^ 63) : ((i << 3) + j)] - 8;
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
        pieceNum = this.#squares[rotated ? ((i << 3) + j ^ 63) : ((i << 3) + j)];
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
  parseUCIMoves(str) {
    this.moves = Move.fromUCIString(str);
  };
  parseBase64Moves(str) {
    this.moves = Move.fromBase64String(str);
  };
  toUCIMoves() {
    let output = [];

    for (const move of this.moves) {
      output.push(Move.toUCIString(move));
    };

    return output.join(" ");
  };
  toBase64Moves(str) {
    let output = [];

    for (const move of this.moves) {
      output.push(Move.toBase64String(move));
    };

    return output.join("");
  };
  displayMove(move, boardEl, rotated = false, sprites = ChessSpritesImageBitmap) {
    const src = Move.getStartSq(move), dst = Move.getTargetSq(move);

    boardEl.querySelector(`[data-index="${rotated ? src ^ 7 : src ^ 56}"]`).classList.add("chess-lastmove-src");
    boardEl.querySelector(`[data-index="${rotated ? dst ^ 7 : dst ^ 56}"]`).classList.add("chess-lastmove-dst");

    // Update the canvas
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    // Source square
    this.#ctx.fillStyle = ((src ^ (src >> 3)) & 1) ? this.#cnvLightColor : this.#cnvDarkColor;
    this.#ctx.fillRect((src & 7) * 100, (src >> 3 ^ 7) * 100, 100, 100);
    // Destination square
    this.#ctx.fillStyle = ((dst ^ (dst >> 3)) & 1) ? this.#cnvLightColor : this.#cnvDarkColor;
    this.#ctx.fillRect((dst & 7) * 100, (dst >> 3 ^ 7) * 100, 100, 100);
    /*
    const sprite = sprites[labels[pieceNum]];
    if (sprite) {
      this.#ctx.drawImage(sprite, (dst & 7) * 100, (dst >> 3 ^ 7) * 100, 100, 100);
    };
    */
  };
  makeMove(move, boardEl) {
    const src = Move.getStartSq(move), dst = Move.getTargetSq(move);
    // Todo
  };
  undoMove(move) {
    // Todo
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

let algebraicToSqNumber = function (str) {
  return str.charCodeAt(0) - 97 + (str.charCodeAt(1) - 49 << 3);
};

let Move = class {
  moveValue;

  static NO_FLAG = 0;
  static EN_PASSANT_FLAG = 1;
  static CASTLE_FLAG = 2;
  static PAWN_DOUBLE_PUSH_FLAG = 3;
  static PROMOTE_TO_QUEEN_FLAG = 4;
  static PROMOTE_TO_KNIGHT_FLAG = 5;
  static PROMOTE_TO_ROOK_FLAG = 6;
  static PROMOTE_TO_BISHOP_FLAG = 7;

  static START_SQ_MASK = 0x003f;
  static TARGET_SQ_MASK = 0x0fc0;
  static FLAG_MASK = 0xf000;

  constructor(moveValue, targetSq, flag) {
    if (!targetSq) {
      this.moveValue = moveValue;
    } else if (!flag) {
      this.moveValue = startSq | targetSq << 6;
    } else {
      this.moveValue = startSq | targetSq << 6 | flag << 12;
    };
  };

  static isNull(n) {
    return n === 0;
  };
  static getStartSq(n) {
    return n & this.START_SQ_MASK;
  };;
  static getTargetSq(n) {
    return (n & this.TARGET_SQ_MASK) >> 6;
  };
  static isPromotion(n) {
    return (n & this.FLAG_MASK) >= this.PROMOTE_TO_QUEEN_FLAG;
  };
  static isEnPassant(n) {
    return (n & this.FLAG_MASK) === this.EN_PASSANT_FLAG;
  };
  nullMove = new Move(0);
  static getPromotionPieceType(n) {
    switch (n & this.FLAG_MASK) {
      case this.PROMOTE_TO_ROOK_FLAG:
        return Piece.ROOK;
      case this.PROMOTE_TO_KNIGHT_FLAG:
        return Piece.KNIGHT;
      case this.PROMOTE_TO_BISHOP_FLAG:
        return Piece.BISHOP;
      case this.PROMOTE_TO_QUEEN_FLAG:
        return Piece.QUEEN;
      default:
        return 0;
    };
  };
  static isSameMove(a, b) {
    return a.moveValue === b.moveValue;
  };
  static fromUCIString(str) {
    const chunks = str.split(" ");
    let moves = [];

    for (const chunk of chunks) {
      const squares = chunk.match(/[a-h]\d/gi);
      let move = algebraicToSqNumber(squares[0]) | algebraicToSqNumber(squares[1]) << 6;

      // castle flag
      if (move === 132 || move === 388 || move === 3772 || move === 4028) {
        move |= 0x2000;
      };

      // pawn double push flag
      if ((move & 0x608) === 0x608 || (move & 0x830) === 0x830) {
        move |= 0x3000;
      };

      switch (chunk.charCodeAt(4)) { // promotion flag
        case 113: // queen
        case 81:
          move |= 0x4000;
          break;
        case 110: // knight
        case 78:
          move |= 0x5000;
          break;
        case 114: // rook
        case 82:
          move |= 0x6000;
          break;
        case 98: // bishop
        case 66:
          move |= 0x7000;
          break;
      };

      moves.push(move);
    };

    return moves;
  };
  static fromBase64String(str) {
    const base64char = "456789+/wxyz0123opqrstuvghijklmnYZabcdefQRSTUVWXIJKLMNOPABCDEFGH";
    const chunks = str.match(/.{2}/g);
    let moves = [];

    for (const chunk of chunks) {
      let move = base64char.indexOf(chunk[0]) | base64char.indexOf(chunk[1]) << 6;

      // castle flag
      if (move === 132 || move === 388 || move === 3772 || move === 4028) {
        move |= 0x2000;
      };

      // pawn double push flag
      if ((move & 0x608) === 0x608 || (move & 0x830) === 0x830) {
        move |= 0x3000;
      };

      switch (chunk.charCodeAt(4)) { // promotion flag
        case 113: // queen
        case 81:
          move |= 0x4000;
          break;
        case 110: // knight
        case 78:
          move |= 0x5000;
          break;
        case 114: // rook
        case 82:
          move |= 0x6000;
          break;
        case 98: // bishop
        case 66:
          move |= 0x7000;
          break;
      };

      moves.push(move);
    };

    return moves;
  };
  toString() {
    const promotionPiece = ".kqrnbp.";
    const promotionPieceType = promotionPiece[this.getPromotionPieceType(n)];
    return sqNumberToAlgebraic(this.moveValue & 63) + sqNumberToAlgebraic(this.moveValue >> 6 & 63) + (promotionPieceType === "." ? "" : promotionPieceType);
  };
  static toUCIString(n) {
    const promotionPiece = ".kqrnbp.";
    const promotionPieceType = promotionPiece[this.getPromotionPieceType(n)];
    return sqNumberToAlgebraic(n & 63) + sqNumberToAlgebraic(n >> 6 & 63) + (promotionPieceType === "." ? "" : promotionPieceType);
  };
  static toBase64String(n) {
    const base64char = "456789+/wxyz0123opqrstuvghijklmnYZabcdefQRSTUVWXIJKLMNOPABCDEFGH";
    // const promotionPieceType = promotionPiece[this.getPromotionPieceType(n)];
    return base64char[this.getStartSq(n)] + base64char[this.getTargetSq(n)];
  };
};

let bitboardToString = function (bitboard) {
  return bitboard.toString(2).padStart(64, "0").match(/.{8}/g).join("\n");
};
