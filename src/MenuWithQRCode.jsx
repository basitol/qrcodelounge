import React from "react";
import QRCode from "qrcode.react";
import { Document, Page } from "react-pdf";

function MenuWithQRCode() {
  // Replace 'your-pdf-menu-link' with the actual link to your PDF menu.
  const menuLink = "https://example.com/your-pdf-menu.pdf";

  const [numPages, setNumPages] = React.useState(null);
  const [pageNumber, setPageNumber] = React.useState(1);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  return (
    <div>
      <h1>Restaurant Menu</h1>
      <Document file={menuLink} onLoadSuccess={onDocumentLoadSuccess}>
        <Page pageNumber={pageNumber} />
      </Document>
      <p>
        Page {pageNumber} of {numPages}
      </p>

      <div className="qr-code-container">
        <QRCode value={menuLink} />
        <p>Scan to view the menu</p>
      </div>
    </div>
  );
}

export default MenuWithQRCode;
