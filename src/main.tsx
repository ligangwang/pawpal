import { createRoot } from "react-dom/client";
import "@fontsource-variable/space-grotesk";
import "./pawpal.css";
import { connect } from "../sdk/dingn-sdk.js";
import { DingnProvider } from "./dingn";
import { PawpalGame } from "./pet-game";

const sdk = await connect();
document.documentElement.lang = sdk.locale;
createRoot(document.getElementById("root")!).render(
  <DingnProvider sdk={sdk}>
    <PawpalGame />
  </DingnProvider>,
);
sdk.ready();
