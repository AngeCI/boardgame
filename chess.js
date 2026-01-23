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

  cnvLightColor = "#f1d9c0";
  cnvDarkColor = "#a97a65";

  isWhiteToMove;
  plyCount;
  moves = [];
  enPassantFile = null;

  castlingRights = 15;
  whiteKingsideCastleMask = 1;
  whiteQueensideCastleMask = 2;
  blackKingsideCastleMask = 4;
  blackQueensideCastleMask = 8;

  // Piece lists
  // Store all lists in a 2D array: [colorIndex][pieceType]
  // colorIndex 0 = White, 1 = Black
  #pieceLists = [
    [[], [], [], [], [], [], []], // White (Indices 0-6)
    [[], [], [], [], [], [], []]  // Black (Indices 0-6)
  ];
  #allPieceLists = [[], []]; // [colorIndex] -> All occupied squares for that color

  // Bitboards
  pieceBitboards = new Uint32Array(24); // Bitboard for each piece type and colour (white pawns, white knights, ... black pawns, etc.)
  colourBitboards = new Uint32Array(4); // Bitboards for all pieces of either colour (all white pieces, all black pieces)
  allPiecesBitboard = new Uint32Array(2); // Bitboards for all occupied squares
  FriendlyOrthogonalSliders;
  FriendlyDiagonalSliders;
  EnemyOrthogonalSliders;
  EnemyDiagonalSliders;

  #isDirty = true; // Flag for lazy piece list and bitboard updates

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
        this.#ctx.fillStyle = ((y ^ x) & 1) ? this.cnvDarkColor : this.cnvLightColor;
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
    // Clear all existing lists first
    for (let i = 0; i < 2; i++) {
      this.#allPieceLists[i].length = 0;
      for (let j = 0; j < 7; j++) {
        this.#pieceLists[i][j].length = 0;
      };
    };

    // Populate lists
    for (let i = 0; i < this.#squares.length; i++) {
      const piece = this.#squares[i];
      if (piece === Piece.NONE) continue;

      // Extract color and type from the combined value
      const colorIdx = (piece >> 3) - 1; // 0 for White (8), 1 for Black (16)
      const type = piece & Piece.TYPE_MASK;

      // Add to specific list (e.g., White Knights)
      this.#pieceLists[colorIdx][type].push(i);

      // Add to general list (e.g., All White Pieces)
      this.#allPieceLists[colorIdx].push(i);
    };

    this.allPiecesBitboard = new Uint32Array(2); // Needs to be declared once more?

    // Reset all bitboards to zero
    this.pieceBitboards.fill(0);
    this.colourBitboards.fill(0);
    this.allPiecesBitboard.fill(0);

    // Single pass over the 64 squares
    for (let sq = 0; sq < 64; sq++) {
      const piece = this.#squares[sq];
      if (piece === Piece.NONE) continue;

      const colorIdx = (piece >> 3) - 1; // 0 for White (8), 1 for Black (16)
      const typeIdx = (piece & Piece.TYPE_MASK) - 1; // 0-5 (Pawn-King)

      // Calculate bit position
      // wordIdx is 0 for squares 0-31, 1 for squares 32-63
      const wordIdx = sq >> 5;
      const bit = 1 << (sq & 31);

      // Update Piece Bitboard: (color * 6 types + type) * 2 words + wordIdx
      const pbbIdx = ((colorIdx * 6 + typeIdx) << 1) + wordIdx;
      this.pieceBitboards[pbbIdx] |= bit;

      // Update Color Bitboard: (color * 2 words) + wordIdx
      const cbbIdx = (colorIdx << 1) + wordIdx;
      this.colourBitboards[cbbIdx] |= bit;

      // Update All Pieces Bitboard
      this.allPiecesBitboard[wordIdx] |= bit;
    }
  };
  /**
   * Call this whenever a square on the board changes.
   */
  #invalidate() {
    this.#isDirty = true;
  };
  /**
   * The "Lazy" update: only runs if the board has changed since the last request.
   */
  #ensureUpToDate() {
    if (!this.#isDirty) return;

    this.redrawCanvas();
    this.refreshPieceList();

    this.#isDirty = false;
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

    const [board, moveSide, castlingRights, , , plyCount] = fen.split(" ");
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

    // this.castlingRights = castlingRights;

    this.#invalidate();
    this.#ensureUpToDate();
  };
  importFromBase64(str) {
    const chunks = str.split(":");
    const binArray = atob(chunks[0]);
    for (let i = 0; i < binArray.length; i++) {
      let a = binArray.charCodeAt(i);
      for (let j = 0; j < 2; j++) {
        const nibble = (a & 0xf0) >> 4;
        this.#squares[i << 1 | j] = nibble + ((nibble > 0) << 3);
        a <<= 4;
      };
    };

    this.#invalidate();
    this.#ensureUpToDate();
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

    const castlingRights = ["-", "K", "Q", "KQ", "k", "Kk", "Qk", "KQk", "q", "Kq", "Qq", "KQq", "kq", "Kkq", "Qkq", "KQkq"][this.castlingRights];

    return `${output} ${this.isWhiteToMove ? "w" : "b"} ${castlingRights} - 0 ${(this.plyCount >> 1) + 1}`;
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
    this.#ensureUpToDate();
    const colorIdx = (color >> 3) - 1; // 0 for White (8), 1 for Black (16)
    const list = this.#pieceLists[colorIdx]?.[pieceType];

    if (!list) throw new TypeError("Invalid piece type or color.");
    return list;
  };
  getAllPieceLists() {
    this.#ensureUpToDate();
    return {
      "king": [this.#pieceLists[0][Piece.KING], this.#pieceLists[1][Piece.KING]],
      "queen": [this.#pieceLists[0][Piece.QUEEN], this.#pieceLists[1][Piece.QUEEN]],
      "rook": [this.#pieceLists[0][Piece.ROOK], this.#pieceLists[1][Piece.ROOK]],
      "knight": [this.#pieceLists[0][Piece.KNIGHT], this.#pieceLists[1][Piece.KNIGHT]],
      "bishop": [this.#pieceLists[0][Piece.BISHOP], this.#pieceLists[1][Piece.BISHOP]],
      "pawn": [this.#pieceLists[0][Piece.PAWN], this.#pieceLists[1][Piece.PAWN]],
      "allPieces": this.#allPieceLists
    };
  };
  getPieceBitboard(type, isWhite) {
    this.#ensureUpToDate();
    const colorIdx = (color >> 3) - 1; // 0 for White (8), 1 for Black (16)

    if (type === 0) { // Empty pieces
      return new Uint32Array([
        ~this.allPiecesBitboard[0],
        ~this.allPiecesBitboard[1]
      ]);
    } else if (type === 7) { // Assuming all pieces
      const offset = colorIdx << 1;
      return colourBitboards.subarray(offset, offset + 2);
    } else if (type > 0 && type < 7) {
      this.#ensureUpToDate();
      const bbIdx = (colorIdx * 6 + type - 1) << 1;
      return pieceBitboards.subarray(bbIdx, bbIdx + 2);
    } else {
      throw new TypeError("Invalid piece type.");
    };
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
    this.#ctx.fillStyle = ((src ^ (src >> 3)) & 1) ? this.cnvLightColor : this.cnvDarkColor;
    this.#ctx.fillRect((src & 7) * 100, (src >> 3 ^ 7) * 100, 100, 100);
    // Destination square
    this.#ctx.fillStyle = ((dst ^ (dst >> 3)) & 1) ? this.cnvLightColor : this.cnvDarkColor;
    this.#ctx.fillRect((dst & 7) * 100, (dst >> 3 ^ 7) * 100, 100, 100);
    const sprite = sprites[labels[this.#squares[dst ^ 56] - 8]];
    if (sprite) {
      this.#ctx.drawImage(sprite, (dst & 7) * 100, (dst >> 3 ^ 7) * 100, 100, 100);
    };

    this.#isDirty = false;
  };
  makeMove(move) {
    const src = Move.getStartSq(move) ^ 56, dst = Move.getTargetSq(move) ^ 56;
    // Todo
    this.#squares[dst] = this.#squares[src];
    this.#squares[src] = Piece.NONE;
    this.#invalidate();
  };
  undoMove(move) {
    // Todo
  };
  hasKingsideCastleRight(isWhite) {
    return (this.castlingRights & (isWhite ? 1 : 4)) !== 0;
  };
  hasQueensideCastleRight(isWhite) {
    return (this.castlingRights & (isWhite ? 2 : 8)) !== 0;
  };
  setPiece(index, newPiece) {
    this.#squares[index] = newPiece;
    this.#invalidate();
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

  "TYPE_MASK": 7,
  "COLOR_MASK": 24,

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

let bitboardToList = function (bitboard) {
  let low = 0, high = 0;

  if (typeof bitboard === "bigint") {
    low = Number(input & 0xffffffffn);
    high = Number(input >> 32n);
  } else if (input.length >= 2) {
    low = bitboard[0];
    high = bitboard[1];
  } else {
    throw new TypeError();
  };

  const arr = [];
  const scan = (val, offset) => {
    // Convert to unsigned for bitwise consistency
    let uVal = val >>> 0;
    while (uVal !== 0) {
      const lsb = val & -val;
      const index = 31 - Math.clz32(lsb);
      arr.push(index + offset);
      uVal ^= lsb;
    };
  };

  scan(low, 0);
  scan(high, 32);
  return arr;
};

let listToBitboard = function (arr) {
  let bitboard = new Uint32Array(2);
  for (const e of arr) {
    if (e < 64) {
      if (e < 32) {
        bitboard[1] |= 1 << (e ^ 31);
      } else {
        bitboard[0] |= 1 << (e ^ 63);
      };
    };
  };
  return bitboard;
};
