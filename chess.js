"use strict";

if (typeof Uint8Array.fromBase64 !== "function") {
  Uint8Array.fromBase64 = function (base64) {
    if (typeof base64 !== "string") {
      throw new TypeError("input argument must be a string");
    };
    const str = window.atob(base64);
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i);
    };
    return arr;
  };
};

if (typeof Uint8Array.prototype.toBase64 !== "function") {
  Uint8Array.prototype.toBase64 = function () {
    return window.btoa(Array.from(this, (byte) => String.fromCharCode(byte)).join(""));
  };
};

Array.prototype.updateOrDrop = function (target, newValue) {
  const index = this.indexOf(target);
  if (index === -1) return; // If no match, do nothing

  if (newValue === null || newValue === undefined) {
    this.splice(index, 1);
  } else {
    this[index] = newValue;
  };
};

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
    "movePiece": BitboardHelperObj.instance.exports.g,
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
  bmpSprites;
  vectorSprites;

  initialPos = new Uint8Array(64);
  isWhiteToMove;
  plyCount = 0;
  fiftyMoveCounter = 0;
  moves = [];
  enPassantFile = null;

  castlingRights = 15;
  static WHITE_KINGSIDE  = 1; // 0001
  static WHITE_QUEENSIDE = 2; // 0010
  static BLACK_KINGSIDE  = 4; // 0100
  static BLACK_QUEENSIDE = 8; // 1000

  // Piece lists
  // Store all lists in a 2D array: [colorIndex][pieceType]
  // colorIndex 0 = White, 1 = Black
  #pieceLists = [
    [[], [], [], [], [], [], [], []], // White (Indices 0-7)
    [[], [], [], [], [], [], [], []]  // Black (Indices 0-7)
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
  };

  redrawCanvas() {
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    let pieceNum;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        this.#ctx.fillStyle = ((y ^ x) & 1) ? this.cnvDarkColor : this.cnvLightColor;
        this.#ctx.fillRect(x * 100, y * 100, 100, 100);

        pieceNum = this.#squares[(y << 3) + x] - 8;
        let sprite = this.bmpSprites[labels[pieceNum]];
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

    // Reset all bitboards to zero
    this.pieceBitboards.fill(0);
    this.colourBitboards.fill(0);
    this.allPiecesBitboard.fill(0);

    // Populate lists
    for (let i = 0; i < this.#squares.length; i++) {
      const piece = this.#squares[i];
      if (piece === Piece.NONE) continue;

      // Extract color and type from the combined value
      const colorIdx = (piece >> 3) - 1; // 0 for White (8), 1 for Black (16)
      const type = piece & Piece.TYPE_MASK;

      this.#pieceLists[colorIdx][type].push(i); // Add to specific list (e.g., White Knights)
      this.#allPieceLists[colorIdx].push(i); // Add to general list (e.g., All White Pieces)

      // Calculate bit position
      // wordIdx is 0 for squares 0-31, 1 for squares 32-63
      const wordIdx = i >> 5;
      const bit = 1 << (i & 31);

      // Update Piece Bitboard: (color * 6 types + type) * 2 words + wordIdx
      const pbbIdx = ((colorIdx * 6 + type - 1) << 1) + wordIdx;
      this.pieceBitboards[pbbIdx] |= bit;

      // Update Color Bitboard: (color * 2 words) + wordIdx
      const cbbIdx = (colorIdx << 1) + wordIdx;
      this.colourBitboards[cbbIdx] |= bit;

      // Update All Pieces Bitboard
      this.allPiecesBitboard[wordIdx] |= bit;
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

    const [board, moveSide, castlingRights, epTarget, fiftyMoveCounter, plyCount] = fen.split(" ");
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

    const castlingRightsPattern = /^(?:[KQkq]+|-)$/;
    if (!castlingRightsPattern.test(castlingRights)) {
      throw new TypeError(`Unable to parse castling rights: "${castlingRights}". Only 'K', 'Q', 'k', 'q', or '-' are allowed.`);
    };

    this.castlingRights = 0;

    if (castlingRights.includes("K")) this.castlingRights |= Board.WHITE_KINGSIDE;
    if (castlingRights.includes("Q")) this.castlingRights |= Board.WHITE_QUEENSIDE;
    if (castlingRights.includes("k")) this.castlingRights |= Board.BLACK_KINGSIDE;
    if (castlingRights.includes("q")) this.castlingRights |= Board.BLACK_QUEENSIDE;

    if (new Set(castlingRights).size !== castlingRights.length) {
      throw new TypeError(`Invalid castling rights: Duplicate characters found in "${castlingRights}"`);
    };

    if (epTarget === "-") {
      this.enPassantFile = null;
    } else {
      // 1. Basic Format Validation (Regex)
      // Must be a-h followed by 3 (if black to move) or 6 (if white to move)
      const epTargetPattern = /^[a-h][36]$/;
      if (!epTargetPattern.test(epTarget)) {
        throw new TypeError(`Invalid en passant target: ${epTarget}`);
      };

      const fileChar = epTarget[0];
      const rankChar = epTarget[1];

      // 2. Rank Validation based on side to move
      // If White is to move, Black just moved p7->p5, so target is rank 6.
      // If Black is to move, White just moved p2->p4, so target is rank 3.
      const expectedRank = this.isWhiteToMove ? "6" : "3";
      if (rankChar !== expectedRank) {
        throw new TypeError(`En passant target ${epTarget} is invalid for ${this.isWhiteToMove ? "white" : "black"} to move.`);
      };

      // 3. Verify the pawn exists on the square "behind" the target
      // If target is e6 (rank index 5), the pawn is on e5 (rank index 4).
      // If target is e3 (rank index 2), the pawn is on e4 (rank index 3).
      const targetSq = algebraicToSqNumber(epTarget) ^ 56;
      const pawnSq = targetSq + (this.isWhiteToMove ? 8 : -8);
      const piece = this.#squares[pawnSq];
      const enemyColor = this.isWhiteToMove ? 16 : 8;
      if ((piece & Piece.TYPE_MASK) !== Piece.PAWN || (piece & Piece.COLOR_MASK) !== enemyColor) {
        throw new TypeError(`No enemy pawn positioned to allow en passant at ${epTarget}.`);
      };

      // 4. Success: Store the file index (0-7)
      this.enPassantFile = fileChar.charCodeAt(0) - 97;
    };

    this.fiftyMoveCounter = parseInt(fiftyMoveCounter);

    this.plyCount = (parseInt(plyCount) - 1 << 1) + !this.isWhiteToMove;

    // this.castlingRights = castlingRights;

    this.#invalidate();
    this.#ensureUpToDate();
  };
  importFromBase64(str) {
    const chunks = str.split(":");
    const binArray = Uint8Array.fromBase64(chunks[0]);
    for (let i = 0; i < binArray.length; i++) {
      let a = binArray[i];
      for (let j = 0; j < 2; j++) {
        const nibble = (a & 0xf0) >> 4;
        this.#squares[i << 1 | j] = nibble + ((nibble > 0) << 3);
        a <<= 4;
      };
    };

    if (chunks[1]) {
      const gameState = Uint8Array.fromBase64(chunks[1]);
      this.isWhiteToMove = !(gameState[0] & 128); // 0 for white, 1 for black
      this.castlingRights = gameState[0] >> 3;
      this.enPassantFile = (gameState[1] & 128) ? (gameState[0] & 7) : null;
      this.plyCount = ((gameState[1] & 1) << 8) + gameState[2];
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

    let castlingRights = "";
    if (this.castlingRights & Board.WHITE_KINGSIDE)  castlingRights += "K";
    if (this.castlingRights & Board.WHITE_QUEENSIDE) castlingRights += "Q";
    if (this.castlingRights & Board.BLACK_KINGSIDE)  castlingRights += "k";
    if (this.castlingRights & Board.BLACK_QUEENSIDE) castlingRights += "q";
    if (!castlingRights) castlingRights = "-";

    let epTarget = "-";
    if (this.enPassantFile) {
      epTarget = String.fromCharCode(this.enPassantFile + 97) + (this.isWhiteToMove ? 6 : 3);
    };

    return `${output} ${this.isWhiteToMove ? "w" : "b"} ${castlingRights} ${epTarget} ${this.fiftyMoveCounter} ${(this.plyCount >> 1) + 1}`;
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

    let gameState = new Uint8Array(3);
    gameState[0] = (!this.isWhiteToMove << 7) | (this.castlingRights << 3) | (this.enPassantFile);
    gameState[1] = (!!this.enPassantFile << 7) | (this.plyCount >> 8);
    gameState[2] = this.plyCount;

    return arr.toBase64().slice(0, -1) + ":" + gameState.toBase64(); // remove the trailing '='
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

    if (type === 0) { // Empty pieces
      return new Uint32Array([
        ~this.allPiecesBitboard[0],
        ~this.allPiecesBitboard[1]
      ]);
    } else if (type === 7) { // Assuming all pieces
      const offset = !isWhite << 1;
      return colourBitboards.subarray(offset, offset + 2);
    } else if (type > 0 && type < 7) {
      this.#ensureUpToDate();
      const bbIdx = (!isWhite * 6 + type - 1) << 1;
      return this.pieceBitboards.subarray(bbIdx, bbIdx + 2);
    } else {
      throw new TypeError("Invalid piece type.");
    };
  };
  drawBoard(boardEl, rotated = false) {
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    const boardRows = boardEl.children;
    let boardGrids, pieceNum;

    for (let i = 0; i < 8; i++) {
      boardGrids = boardRows[i].children;
      for (let j = 0; j < 8; j++) {
        boardGrids[j].innerHTML = "";
        pieceNum = this.#squares[rotated ? ((i << 3) + j ^ 63) : ((i << 3) + j)] - 8;
        let sprite = this.vectorSprites[labels[pieceNum]];
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
  displayMove(move, boardEl, rotated = false) {
    const src = Move.getStartSq(move), dst = Move.getTargetSq(move);

    const srcDOM = boardEl.querySelector(`[data-index="${rotated ? src ^ 7 : src ^ 56}"]`);
    const dstDOM = boardEl.querySelector(`[data-index="${rotated ? dst ^ 7 : dst ^ 56}"]`);

    srcDOM.classList.add("chess-lastmove-src");
    dstDOM.classList.add("chess-lastmove-dst");

    srcDOM.innerHTML = "";

    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    let sprite = this.vectorSprites[labels[this.#squares[dst ^ 56] - 8]];
    if (sprite) {
      dstDOM.appendChild(sprite.cloneNode(true));
    };
  };
  makeMoveCanvas(move) {
    const src = Move.getStartSq(move), dst = Move.getTargetSq(move);
    const movedPiece = this.#squares[dst ^ 56];

    // Update the canvas
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    // Source square
    this.#ctx.fillStyle = ((src ^ (src >> 3)) & 1) ? this.cnvLightColor : this.cnvDarkColor;
    this.#ctx.fillRect((src & 7) * 100, (src >> 3 ^ 7) * 100, 100, 100);
    // Destination square
    this.#ctx.fillStyle = ((dst ^ (dst >> 3)) & 1) ? this.cnvLightColor : this.cnvDarkColor;
    this.#ctx.fillRect((dst & 7) * 100, (dst >> 3 ^ 7) * 100, 100, 100);
    let sprite = this.bmpSprites[labels[movedPiece - 8]];
    // Handle promotion, not needed?
    /*
    if (Move.isPromotion(move)) {
      const promotionPieceType = Move.getPromotionPieceType(move);
      sprite = this.bmpSprites[labels[promotionPieceType - 8]];
    };
    */
    if (sprite) {
      this.#ctx.drawImage(sprite, (dst & 7) * 100, (dst >> 3 ^ 7) * 100, 100, 100);
    };

    // En passant, clear the captured pawn
    const isEnPassant = Move.isEnPassant(move) && ((movedPiece & Piece.TYPE_MASK) === Piece.PAWN);
    if (isEnPassant) {
      const captureSq = (isEnPassant ?
        (dst + (this.isWhiteToMove ? 8 : -8)) : // this.isWhiteToMove is flipped before calling makeMoveCanvas()
        dst) ^ 56;
      this.#ctx.fillStyle = ((captureSq ^ (captureSq >> 3)) & 1) ? this.cnvDarkColor : this.cnvLightColor;
      this.#ctx.fillRect((captureSq & 7) * 100, (captureSq >> 3) * 100, 100, 100);
    };

    // Move the rook for castling
    if (((move & Move.FLAG_MASK) === Move.CASTLE_FLAG << 12) && ((movedPiece & Piece.TYPE_MASK) === Piece.KING)) {
      const kingside = dst === 6 || dst === 62; // if target square is g1 or g8
      const castlingRookFromIndex = dst + (kingside ? 1 : -2);
      const castlingRookToIndex = dst + (kingside ? -1 : 1);

      // Source square
      this.#ctx.fillStyle = ((castlingRookFromIndex ^ (castlingRookFromIndex >> 3)) & 1) ? this.cnvLightColor : this.cnvDarkColor;
      this.#ctx.fillRect((castlingRookFromIndex & 7) * 100, (castlingRookFromIndex >> 3 ^ 7) * 100, 100, 100);
      // Destination square
      this.#ctx.fillStyle = ((castlingRookToIndex ^ (castlingRookToIndex >> 3)) & 1) ? this.cnvLightColor : this.cnvDarkColor;
      this.#ctx.fillRect((castlingRookToIndex & 7) * 100, (castlingRookToIndex >> 3 ^ 7) * 100, 100, 100);
      this.#ctx.drawImage(this.bmpSprites[this.isWhiteToMove ? "bR" : "wR"], (castlingRookToIndex & 7) * 100, (castlingRookToIndex >> 3 ^ 7) * 100, 100, 100); // this.isWhiteToMove is flipped before calling makeMoveCanvas()
    };

    this.#isDirty = false;
  };
  #movePiece(move) {
    const src = Move.getStartSq(move) ^ 56, dst = Move.getTargetSq(move) ^ 56, colorIdx = Number(!this.isWhiteToMove), piece = this.#squares[src];

    // BitboardHelper.movePiece(this.getPieceBitboard(piece, colorIdx), src, dst);
    // BitboardHelper.movePiece(this.getPieceBitboard(7, colorIdx), src, dst);
    // BitboardHelper.movePiece(allPiecesBitboard, src, dst);

    this.#pieceLists[colorIdx][piece & Piece.TYPE_MASK].updateOrDrop(src, dst);
    this.#allPieceLists[colorIdx].updateOrDrop(src, dst);
    this.#squares[dst] = piece;
    this.#squares[src] = Piece.NONE;
  };
  makeMove(move) {
    const src = Move.getStartSq(move) ^ 56, dst = Move.getTargetSq(move) ^ 56, colorIdx = Number(!this.isWhiteToMove), enemyPawn = this.isWhiteToMove ? 22 : 14;
    const movedPiece = this.#squares[src];
    const isEnPassant = Move.isEnPassant(move) && ((movedPiece & Piece.TYPE_MASK) === Piece.PAWN);
    const capturedPiece = isEnPassant ? (this.isWhiteToMove ? 22 : 14) : this.#squares[dst];

    this.#movePiece(move);

    // Captures and en passant
    if (capturedPiece) {
      // If there's no enemy pawn at the en passant target sqaure, it's not an en passant
      if (isEnPassant && (this.#squares[dst + (this.isWhiteToMove ? 8 : -8)] !== enemyPawn)) {
        isEnPassant = false;
      };

      const captureSq = isEnPassant ?
        (dst + (this.isWhiteToMove ? 8 : -8)) :
        dst;

      // BitboardHelper.clearSquare(capturedPiece, this.isWhiteToMove, captureSq);
      // BitboardHelper.clearSquare(7, this.isWhiteToMove, captureSq);
      this.#pieceLists[colorIdx][capturedPiece & Piece.TYPE_MASK].updateOrDrop(captureSq);
      this.#allPieceLists[colorIdx].updateOrDrop(captureSq);

      if (isEnPassant) {
        this.#squares[captureSq] = 0;
      };
    };

    // Castling
    if ((movedPiece & Piece.TYPE_MASK) === Piece.KING) {
      this.castlingRights &= this.isWhiteToMove ? ~(Board.WHITE_KINGSIDE | Board.WHITE_QUEENSIDE) : ~(Board.BLACK_KINGSIDE | Board.BLACK_QUEENSIDE); // deprive castling rights

      if ((move & Move.FLAG_MASK) === Move.CASTLE_FLAG << 12) {
        const kingside = dst === 6 || dst === 62; // if target square is g1 or g8
        const castlingRookFromIndex = dst + (kingside ? 1 : -2);
        const castlingRookToIndex = dst + (kingside ? -1 : 1);

        // Update rook position
        // BitboardHelper.movePiece(capturedPiece, castlingRookFromIndex, castlingRookToIndex);
        // BitboardHelper.movePiece(7, castlingRookFromIndex, castlingRookToIndex);
        this.#pieceLists[colorIdx][Piece.ROOK].updateOrDrop(castlingRookFromIndex, castlingRookToIndex);
        this.#allPieceLists[colorIdx].updateOrDrop(castlingRookFromIndex, castlingRookToIndex);
        this.#squares[castlingRookFromIndex] = 0;
        this.#squares[castlingRookToIndex] = Piece.ROOK | (this.isWhiteToMove ? Piece.WHITE : Piece.BLACK);
      };
    };

    // Promotion
    if (Move.isPromotion(move)) {
      const promotionPieceType = Move.getPromotionPieceType(move);

      // Remove pawn from promotion square and add promoted piece instead
      // BitboardHelper.clearSquare(movedPiece, dst);
      // BitboardHelper.setSquare(promotionPieceType, dst);
      this.#pieceLists[colorIdx][Piece.PAWN].updateOrDrop(dst);
      this.#pieceLists[colorIdx][promotionPieceType].push(dst);
    };

    // Pawn has moved two sqaures forward, mark file with en-passant flag
    if (
      ((move & Move.FLAG_MASK) === Move.PAWN_DOUBLE_PUSH_FLAG << 12) &&
      ((movedPiece & Piece.TYPE_MASK) === Piece.PAWN) &&
      ((this.#squares[dst - 1] === enemyPawn) || (this.#squares[dst + 1] === enemyPawn)) // Also check if there's an enemy pawn next to it
    ) {
      this.enPassantFile = src & 7;
    } else {
      this.enPassantFile = null;
    };

    // Update castling rights
    // Any piece moving to/from rook square removes castling right for that side
    if (this.castlingRights) {
      if (dst === 63 || src === 63) {
        this.castlingRights &= ~Board.WHITE_KINGSIDE;
      } else if (dst === 56 || src === 56) {
        this.castlingRights &= ~Board.WHITE_QUEENSIDE;
      };
      if (dst === 7 || src === 7) {
        this.castlingRights &= ~Board.BLACK_KINGSIDE;
      } else if (dst === 0 || src === 0) {
        this.castlingRights &= ~Board.BLACK_QUEENSIDE;
      };
    };

    // Change side to move
    this.isWhiteToMove = !this.isWhiteToMove;
    this.plyCount++;

    let newFiftyMoveCounter = this.fiftyMoveCounter + 1;
    // Pawn moves and captures reset the fifty move counter and clear 3-fold repetition history
    if (movedPiece === Piece.PAWN || capturedPiece) {
      newFiftyMoveCounter = 0;
    };
    this.fiftyMoveCounter = newFiftyMoveCounter;

    this.makeMoveCanvas(move);
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

    // Update the canvas
    const labels = [" ", "wK", "wQ", "wR", "wN", "wB", "wP", " ", " ", "bK", "bQ", "bR", "bN", "bB", "bP", " "];
    this.#ctx.fillStyle = ((index ^ (index >> 3)) & 1) ? this.cnvDarkColor : this.cnvLightColor;
    this.#ctx.fillRect((index & 7) * 100, (index >> 3) * 100, 100, 100);
    const sprite = this.bmpSprites[labels[newPiece - 8]];
    if (sprite) {
      this.#ctx.drawImage(sprite, (index & 7) * 100, (index >> 3) * 100, 100, 100);
    };
  };
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
    return (n & this.FLAG_MASK) >= this.PROMOTE_TO_QUEEN_FLAG << 12;
  };
  static isEnPassant(n) {
    return (n & this.FLAG_MASK) === this.EN_PASSANT_FLAG << 12;
  };
  nullMove = new Move(0);
  static getPromotionPieceType(n) {
    switch ((n & this.FLAG_MASK) >> 12) {
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
      const m = move & ~0x100;
      if (m === 132 || m === 3772) { // move === 132 || move === 388 || move === 3772 || move === 4028
        move |= 0x2000;
      };

      // pawn double push flag
      const files = move & 0xe38;
      if (files === 0x608 || files === 0x830) {
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
      const m = move & ~0x100;
      if (m === 132 || m === 3772) { // move === 132 || move === 388 || move === 3772 || move === 4028
        move |= 0x2000;
      };

      // pawn double push flag
      const files = move & 0xe38;
      if (files === 0x608 || files === 0x830) {
        move |= 0x3000;
      };

      // en passant
      const src = move & 63, dst = (move & 4032) >> 6, diff = dst - src, srcRank = src >> 3;
      if (srcRank === 3 || srcRank === 4) {
        const absDiff = diff < 0 ? -diff : diff;
        // 1. Check if the distance is diagonal (7 or 9)
        // 2. Check if the direction matches the rank (Rank 3 moves -; Rank 4 moves +)
        // 3. Ensure file distance is 1 using XOR to check if file bits changed
        if ((absDiff === 7 || absDiff === 9) && 
          (diff > 0) === (srcRank === 4) && 
          Math.abs((src & 7) - (dst & 7)) === 1) {
          move |= 0x1000;
        };
      };

      /*
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
      */

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
  if (typeof bitboard === "bigint") {
    return bitboard.toString(2).padStart(64, "0").match(/.{8}/g).join("\n");
  } else if (bitboard.length >= 2) {
    let output = "";
    for (const chunk of bitboard) {
      output += chunk.toString(2).padStart(32, "0").match(/.{8}/g).join("\n") + "\n";
    };
    return output;
  } else {
    throw new TypeError();
  };
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
      const lsb = uVal & -uVal;
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
