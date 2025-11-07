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

let Board = class {
  cnv = new OffscreenCanvas(800, 800);
  ctx; // ctx = cnv.getContext("2d");

  constructor() {
    this.ctx = this.cnv.getContext("2d");
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
