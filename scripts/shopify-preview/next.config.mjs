// Isolated UI preview only. No root env files, auth or database runtime imports.
const config={devIndicators:false,agentRules:false,distDir:process.env.SHOPIFY_PREVIEW_DIST_DIR||".next"};
export default config;
