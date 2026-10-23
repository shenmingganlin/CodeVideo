/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Studio 固定用 3100：渲染时的临时服务器从 3000 起找端口，
// Windows 上两者都占 3000 时，渲染会误连到 Studio 而报错。
Config.setStudioPort(3100);
