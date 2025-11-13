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

  const spriteImg = new Image();
  spriteImg.src = "img/cchess_pieces_sprite.svg";
  spriteImg.width = 700;
  spriteImg.height = 200;
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
