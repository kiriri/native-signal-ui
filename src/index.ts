// Side-effect import: pulls the global `JSX` namespace augmentation into the
// package's type graph so consumers get JSX.IntrinsicElements automatically.
import "./core/jsx";

export * from "./core/AB";
export * from "./core/For";
export * from "./core/own";
export * from "./core/If";
export * from "./core/bind";
export * from "./core/bindAttrs";
export * from "./components/Component";
export * as runtime from "./core/jsx-runtime";
