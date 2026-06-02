const QRCode = require('qrcode');

async function generateQr(url) {
  const pngBuffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 600,
    errorCorrectionLevel: 'H',
    margin: 2,
  });
  return pngBuffer;
}

module.exports = { generateQr };
