import { Thunder } from "./pages/Thunder";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/thunder" element={<Thunder />} />
      </Routes>
    </Router>
  );
}

export default App;
