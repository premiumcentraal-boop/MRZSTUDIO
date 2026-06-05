import { createBrowserRouter } from "react-router";
import { AppShell } from "./App";

export const router = createBrowserRouter([
  { path: "*", Component: AppShell },
]);
