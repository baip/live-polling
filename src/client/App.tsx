import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Create from "./pages/Create";
import Present from "./pages/Present";
import Join from "./pages/Join";
import Play from "./pages/Play";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<Create />} />
      <Route path="/present/:code" element={<Present />} />
      <Route path="/join" element={<Join />} />
      <Route path="/play/:code" element={<Play />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
