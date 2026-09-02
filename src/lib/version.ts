import pkg from "../../package.json";

// What is deployed, shown in the admin console. Read from package.json at build
// time, so it is a constant in the bundle and costs nothing at runtime. There is
// no API to ask, and nothing to keep in sync at runtime.
//
// The number is only honest if the tag and package.json agree, so deploy.yml
// refuses a tag that does not match this. Bump package.json in the commit you
// tag.
//
// While a version is in development it carries a prerelease suffix, currently
// 3.0.0-dev. Anyone looking at the admin header can then tell a deployment of
// main from a released one without checking anything else. The suffix comes off
// in the commit that gets tagged.
export const APP_VERSION: string = pkg.version;
