import React from "react";
import { createRoot } from "react-dom/client";
import SekaerthGame from "./SekaerthGame";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Sekaerth app root not found");
createRoot(container).render(<SekaerthGame />);
