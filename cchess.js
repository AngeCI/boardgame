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
    newSvg.setAttribute("width", "100%");
    newSvg.setAttribute("height", "100%");
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

  isRedToMove;
  plyCount;
  moves = [];

  // Piece lists
  // Store all lists in a 2D array: [colorIndex][pieceType]
  // colorIndex 0 = Red, 1 = Black
  #pieceLists = [
    [[], [], [], [], [], [], [], []], // Red (Indices 0-7)
    [[], [], [], [], [], [], [], []]  // Black (Indices 0-7)
  ];
  #allPieceLists = [[], []]; // [colorIndex] -> All occupied squares for that color

  // Bitboards
  pieceBitboards = new Uint32Array(24); // Bitboard for each piece type and colour (red pawns, red knights, ... black pawns, etc.)
  colourBitboards = new Uint32Array(4); // Bitboards for all pieces of either colour (all red pieces, all black pieces)
  allPiecesBitboard; // Bitboards for all oocupied squares

  #isDirty = true; // Flag for lazy piece list and bitboard updates

  constructor() {
    this.#ctx = this.#cnv.getContext("2d");
  };

  redrawCanvas(sprites = CChessSpritesImageBitmap) {
    const labels = [" ", "rK", "rA", "rB", "rN", "rR", "rC", "rP", " ", "bK", "bA", "bB", "bN", "bR", "bC", "bP"];
    let pieceNum;

    this.#ctx.drawImage(boardBackgroundImg, 0, 0, this.#cnv.width, this.#cnv.height);

    for (let y = this.#RANK_TOP; y < this.#RANK_BOTTOM + 1; y++) {
      for (let x = this.#FILE_LEFT; x < this.#FILE_RIGHT + 1; x++) {
        pieceNum = this.#squares[(y << 4) + x] - 8;
        let sprite = sprites[labels[pieceNum]];
        if (sprite) {
          this.#ctx.drawImage(sprite, (x - 3) * 100, (y - 2) * 100, 100, 100);
        };
      };
    };
  };
  refreshPieceList() {
    // Clear all existing lists first
    for (let i = 0; i < 2; i++) {
      this.#allPieceLists[i].length = 0;
      for (let j = 0; j < 8; j++) {
        this.#pieceLists[i][j].length = 0;
      };
    };

    // Populate lists
    for (let i = 0; i < this.#squares.length; i++) {
      const piece = this.#squares[i];
      if (piece === Piece.NONE) continue;

      // Extract color and type from the combined value
      const colorIdx = (piece >> 3) - 1; // 0 for Red (8), 1 for Black (16)
      const type = piece & Piece.TYPE_MASK;

      // Add to specific list (e.g., Red Knights)
      this.#pieceLists[colorIdx][type].push(i);

      // Add to general list (e.g., All Red Pieces)
      this.#allPieceLists[colorIdx].push(i);
    };
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
          let pieceColour = symbol.charCodeAt(0) < 96 ? Piece.RED : Piece.BLACK;
          let pieceType = pieceTypeTable[symbol.toLowerCase()];
          this.#squares[this.convert90to256(rank * 9 + file)] = pieceType | pieceColour;
          file++;
        };
      };
    };

    this.isRedToMove = !(moveSide == "b");
    this.plyCount = (parseInt(plyCount) - 1 << 1) + !this.isRedToMove;

    this.#invalidate();
    this.#ensureUpToDate();
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

    this.#invalidate();
    this.#ensureUpToDate();
  };
  toString() {
    const pieceTable = " 1234567.KABNRCP.kabnrcp";
    const rowMargin = "+---+---+---+---+---+---+---+---+---+\n";
    let output = "  1   2   3   4   5   6   7   8   9  \n" + rowMargin;

    for (let i = this.#RANK_TOP; i < this.#RANK_BOTTOM + 1; i++) {
      for (let j = this.#FILE_LEFT; j < this.#FILE_RIGHT + 1; j++) {
        output += `| ${pieceTable[this.#squares[(i << 4) + j]]} `;
      };

      output += `| ${13 - i}\n`;
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
        let piece = this.#squares[(i << 4) + j];
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

      if (i < this.#RANK_BOTTOM)
        output += "/";
    };

    return `${output} ${this.isRedToMove ? "w" : "b"} - - 0 ${(this.plyCount >> 1) + 1}`;
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
  getPiece(square) {
    return this.#squares[square];
  };
  getPieceList(pieceType, color) {
    this.#ensureUpToDate();
    const colorIdx = (color >> 3) - 1; // 0 for Red (8), 1 for Black (16)
    const list = this.#pieceLists[colorIdx]?.[pieceType];

    if (!list) throw new TypeError("Invalid piece type or color.");
    return list;
  };
  getAllPieceLists() {
    this.#ensureUpToDate();
    return {
      "king": [this.#pieceLists[0][Piece.KING], this.#pieceLists[1][Piece.KING]],
      "advisor": [this.#pieceLists[0][Piece.ADVISOR], this.#pieceLists[1][Piece.ADVISOR]],
      "bishop": [this.#pieceLists[0][Piece.BISHOP], this.#pieceLists[1][Piece.BISHOP]],
      "knight": [this.#pieceLists[0][Piece.KNIGHT], this.#pieceLists[1][Piece.KNIGHT]],
      "rook": [this.#pieceLists[0][Piece.ROOK], this.#pieceLists[1][Piece.ROOK]],
      "cannon": [this.#pieceLists[0][Piece.CANNON], this.#pieceLists[1][Piece.CANNON]],
      "pawn": [this.#pieceLists[0][Piece.PAWN], this.#pieceLists[1][Piece.PAWN]],
      "allPieces": this.#allPieceLists
    };
  };
  /*
  getPieceBitboard(type, isRed) {
    this.#ensureUpToDate();
    // Todo
  };
  */
  drawBoard(boardEl, rotated = false, sprites = CChessSprites) {
    const labels = [" ", "rK", "rA", "rB", "rN", "rR", "rC", "rP", " ", "bK", "bA", "bB", "bN", "bR", "bC", "bP"];
    const boardRows = boardEl.children;
    let boardGrids, pieceNum;

    for (let i = 0; i < 10; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 9; j++) {
        boardGrids[j].innerHTML = "";
        pieceNum = this.#squares[rotated ? this.convert90to256(89 - i * 9 - j) : this.convert90to256(i * 9 + j)] - 8;
        let sprite = sprites[labels[pieceNum]];
        if (sprite) {
          boardGrids[j].appendChild(sprite.cloneNode(true));
        };
      };
    };
  };
  drawTextualBoard(boardEl, rotated = false) {
    const labels = " KABNRCP";
    const boardRows = boardEl.children;
    let boardGrids, pieceNum, pieceType, pieceColor;

    for (let i = 0; i < 10; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 9; j++) {
        pieceNum = this.#squares[rotated ? this.convert90to256(89 - i * 9 - j) : this.convert90to256(i * 9 + j)];
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

    boardEl.querySelector(`[data-index="${rotated ? src : 89 - src}"]`).classList.add("chess-lastmove-src");
    boardEl.querySelector(`[data-index="${rotated ? dst : 89 - dst}"]`).classList.add("chess-lastmove-dst");

    // Update the canvas
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    this.#ctx.fillStyle = "#eb5";
    // Source square
    this.#ctx.fillRect(((src * 7282 & 0xffff) * 9 >>> 16) * 100, (src * 7282 >>> 16) * 100, 100, 100);
    // Destination square
    this.#ctx.fillRect(((dst * 7282 & 0xffff) * 9 >>> 16) * 100, (dst * 7282 >>> 16) * 100, 100, 100);
    const sprite = sprites[labels[this.#squares[dst] - 8]];
    if (sprite) {
      this.#ctx.drawImage(sprite, ((dst * 7282 & 0xffff) * 9 >>> 16) * 100, (dst * 7282 >>> 16) * 100, 100, 100);
    };
  };
  makeMove(move) {
    const src = Move.getStartSq(move), dst = Move.getTargetSq(move);
    // Todo
  };
  /*
  undoMove(move) {
    // Todo
  };
  */
  setPiece(index, newPiece) {
    this.#squares[this.convert90to256(index)] = newPiece;
    this.#invalidate();
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

  "RED": 8,
  "BLACK": 16,

  "TYPE_MASK": 7,
  "COLOR_MASK": 24,

  "isColour": function (piece) {
    return piece >> 3;
  }
};

let sqNumberToAlgebraic = function (n) {
  return String.fromCharCode(((num * 7282 & 0xffff) * 9 >>> 16) + 97) + (9 - (num * 7282 >>> 16));
};

let algebraicToSqNumber = function (str) {
  return str.charCodeAt(0) - 97 + (9 - str.charCodeAt(1) - 48) * 9;
};

let Move = class {
  moveValue;

  static START_SQ_MASK = 0x007f;
  static TARGET_SQ_MASK = 0x3f80;

  constructor(moveValue, targetSq) {
    if (!targetSq) {
      this.moveValue = moveValue;
    } else {
      this.moveValue = startSq | targetSq << 7;
    };
  };

  static isNull(n) {
    return n === 0;
  };
  static getStartSq(n) {
    return n & this.START_SQ_MASK;
  };;
  static getTargetSq(n) {
    return (n & this.TARGET_SQ_MASK) >> 7;
  };
  nullMove = new Move(0);
  static isSameMove(a, b) {
    return a.moveValue === b.moveValue;
  };
  static fromUCIString(str) {
    const chunks = str.split(" ");
    let moves = [];

    for (const chunk of chunks) {
      const squares = chunk.match(/[a-h]\d/gi);
      let move = algebraicToSqNumber(squares[0]) | algebraicToSqNumber(squares[1]) << 7;

      moves.push(move);
    };

    return moves;
  };
  static fromBase64String(str) {
    const base64char = "456789+/wxyz0123opqrstuvghijklmnYZabcdefQRSTUVWXIJKLMNOPABCDEFGH";
    const chunks = str.match(/.{2}/g);
    let moves = [];

    for (const chunk of chunks) {
      let move = base64char.indexOf(chunk[0]) | base64char.indexOf(chunk[1]) << 7;

      moves.push(move);
    };

    return moves;
  };
  toString() {
    const promotionPiece = ".kqrnbp.";
    const promotionPieceType = promotionPiece[this.getPromotionPieceType(n)];
    return sqNumberToAlgebraic(this.moveValue & 63) + sqNumberToAlgebraic(this.moveValue >> 6 & 63);
  };
  static toUCIString(n) {
    const promotionPiece = ".kqrnbp.";
    const promotionPieceType = promotionPiece[this.getPromotionPieceType(n)];
    return sqNumberToAlgebraic(n & 63) + sqNumberToAlgebraic(n >> 6 & 63);
  };
  static toBase64String(n) {
    const base64char = "456789+/wxyz0123opqrstuvghijklmnYZabcdefQRSTUVWXIJKLMNOPABCDEFGH";
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
