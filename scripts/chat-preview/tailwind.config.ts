import base from "../../tailwind.config";
import { fileURLToPath } from "node:url";
const config = {
  ...base,
  content: [
    fileURLToPath(new URL("../../src/**/*.{ts,tsx}", import.meta.url)),
    fileURLToPath(new URL("./app/**/*.{ts,tsx}", import.meta.url)),
  ],
};

export default config;
