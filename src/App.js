import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import QRCodePage from "./QRCodePage";
import MenuPage from "./MenuPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<QRCodePage />} />
        <Route path="/menu" element={<MenuPage />} />
      </Routes>
    </Router>
  );
}

export default App;
