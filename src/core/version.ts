import pkg from "../../package.json" with { type: "json" };

/** Single-source version read from package.json at build time. */
export const VERSION: string = pkg.version;
