import {defineUserConfig} from "vuepress";
import theme from "./theme.js";
import {viteBundler} from '@vuepress/bundler-vite'

export default defineUserConfig({
    dest: "./dev-ops/nginx/html",
    base: "/",

    lang: "zh-CN",
    title: "我的博客",
    description: "日常学习记录",

    theme,

    bundler: viteBundler({
        viteOptions: {
            resolve: {
                alias: {
                    crypto: "crypto-browserify"
                }
            }
        },
        vuePluginOptions: {},
    }),

});
