import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Host from "./pages/Host";
import Phone from "./pages/Phone";
import Join from "./pages/Join";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host/:code" element={<Host />} />
        <Route path="/s/:code" element={<Phone />} />
        <Route path="*" element={<Join />} />
      </Routes>
    </BrowserRouter>
  );
}
