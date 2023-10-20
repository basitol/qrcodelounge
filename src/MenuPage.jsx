import React, { useState } from "react";
import {
  Page1,
  Page2,
  Page3,
  Page4,
  Page5,
  Page6,
  Page7,
  Page8,
  Page9,
} from "./asset";
import { Document, Page } from "react-pdf";

function MenuPage() {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  return (
    <div className="menu">
      <img src={Page1} />
      <img src={Page2} />
      <img src={Page3} />
      <img src={Page4} />
      <img src={Page5} />
      <img src={Page6} />
      <img src={Page7} />
      <img src={Page8} />
      <img src={Page9} />

      <p>
        Page {pageNumber} of {numPages}
      </p>
    </div>
  );
}

export default MenuPage;
