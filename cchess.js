"use strict";

let CChessSprites = {};
let CChessSpritesImageBitmap = {};

let Board = class {
  squares = new Uint8Array(256);
  cnv = new OffscreenCanvas(900, 1200);
  ctx; // ctx = cnv.getContext("2d");

  constructor() {
    this.ctx = this.cnv.getContext("2d");
  };

  redrawCanvas(sprites = CChessSpritesImageBitmap) {
    let img = new Image();
    img.src = "img/cchess_board.svg";
    img.onload = () => {
      this.ctx.drawImage(img, 0, 0, this.cnv.width, this.cnv.height);
    };
  };

  getImage() {
     return this.cnv.convertToBlob();
  };
};
