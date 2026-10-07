import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Create from "./pages/Create";
import Present from "./pages/Present";
import Join from "./pages/Join";
import Play from "./pages/Play";
import Login from "./pages/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/create" element={<Create />} />
      <Route path="/present/:code" element={<Present />} />
      <Route path="/join" element={<Join />} />
      <Route path="/play/:code" element={<Play />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
