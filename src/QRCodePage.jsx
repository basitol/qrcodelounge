import React from "react";
import QRCode from "qrcode.react";

function QRCodePage() {
  // Replace 'your-pdf-menu-link' with the actual link to your PDF menu.
  const menuLink = "https://qrcodelounge.vercel.app/menu";
  const driveLink =
    "https://drive.google.com/file/d/1CYGkMAMFXhsfwFnlYCddVLfaxxbsRc5I/view?usp=sharing";

  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh", // Center vertically in the viewport
  };

  return (
    <div style={containerStyle}>
      <QRCode value={menuLink} />
    </div>
  );
}

export default QRCodePage;
