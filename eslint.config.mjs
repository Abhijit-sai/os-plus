import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    ignores: [
      "outputs/**",
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "scripts/shopify-preview/.next/**",
      "scripts/shopify-preview/next-env.d.ts",
      "scripts/chat-preview/.next/**",
      "scripts/chat-preview/next-env.d.ts",
    ],
  },
];

export default eslintConfig;
