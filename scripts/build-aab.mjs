import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(root, "android");
const keystore = join(root, "store", "pulserush-upload.jks");
const keyProps = join(android, "key.properties");

function run(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ANDROID_HOME: process.env.ANDROID_HOME || "C:\\Users\\olive\\AppData\\Local\\Android\\Sdk", ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || "C:\\Users\\olive\\AppData\\Local\\Android\\Sdk" } });
}

if (!existsSync(join(root, "node_modules"))) run("npm install");
if (!existsSync(android)) run("npx cap add android");
run("npx cap sync android");

mkdirSync(join(root, "store"), { recursive: true });
if (!existsSync(keystore)) {
  const keytool = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, "bin", "keytool")
    : "keytool";
  run(
    `"${keytool}" -genkeypair -v -keystore "${keystore}" -alias pulserush -keyalg RSA -keysize 2048 -validity 10000 -storepass pulserush-upload -keypass pulserush-upload -dname "CN=PulseRush, OU=Arcade, O=PulseRush, L=OKC, ST=OK, C=US"`
  );
}

if (existsSync(join(android, "app"))) {
  writeFileSync(
    keyProps,
    `storePassword=pulserush-upload
keyPassword=pulserush-upload
keyAlias=pulserush
storeFile=${keystore.replace(/\\/g, "/")}
`
  );
}

const gradlew = join(android, "gradlew.bat");
if (!existsSync(gradlew)) {
  console.error("Capacitor Android project missing gradlew. Run: npx cap add android");
  process.exit(1);
}
run("gradlew.bat bundleRelease", android);
console.log("AAB should be at android/app/build/outputs/bundle/release/app-release.aab");
