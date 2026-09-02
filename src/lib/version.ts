import pkg from "../../package.json";

// What is deployed, shown in the admin console. Read from package.json at build
// time, so it is a constant in the bundle and costs nothing at runtime. There is
// no API to ask, and nothing to keep in sync at runtime.
//
// The number is only honest if the tag and package.json agree, so deploy.yml
// refuses a tag that does not match this. Bump package.json in the commit you
// tag.
export const APP_VERSION: string = pkg.version;
