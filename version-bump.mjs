import { readFileSync, writeFileSync } from "fs";

const rawVersion = process.env.npm_package_version;
const targetVersion = rawVersion?.replace(/-beta$/i, "");

if (!targetVersion) {
  throw new Error("npm_package_version is not set");
}

if (rawVersion !== targetVersion) {
  console.info(`Stripping prerelease suffix from ${rawVersion}, using ${targetVersion}`);
}

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
