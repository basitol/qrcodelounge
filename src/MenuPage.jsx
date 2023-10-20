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
  Page10,
  Page11,
  Page12,
  Page13,
  Page14,
  Page15,
  Page16,
  Page17,
  Page18,
  Page19,
  Page20,
  Page21,
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
      <img src={Page10} />
      <img src={Page11} />
      <img src={Page12} />
      <img src={Page13} />
      <img src={Page14} />
      <img src={Page15} />
      <img src={Page16} />
      <img src={Page17} />
      <img src={Page18} />
      <img src={Page19} />
      <img src={Page20} />
      <img src={Page21} />

      <p>
        Page {pageNumber} of {numPages}
      </p>
    </div>
  );
}

export default MenuPage;
