import React from "react";
import QRCode from "qrcode.react";

function QRCodePage() {
  // Replace 'your-pdf-menu-link' with the actual link to your PDF menu.
  const menuLink = "https://qrcodelounge.vercel.app/menu";
  const driveLink =
    "https://drive.google.com/file/d/1CYGkMAMFXhsfwFnlYCddVLfaxxbsRc5I/view?usp=sharing";

  return (
    <div>
      <QRCode value={menuLink} />
      <p>Scan to view the menu</p>
    </div>
  );
}

export default QRCodePage;
