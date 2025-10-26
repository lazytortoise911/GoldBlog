import {navbar} from "vuepress-theme-hope";

export default navbar([
    "/",
    {
        text: "个人简历",
        icon: "book",
        link: "/md/resume"
    },
    {
        text: "开发日志",
        icon: "book",
        link: "/md/dev-log/",
        activeMatch: "^/md/dev-log/$"
    },
    {
        text: "设计模式",
        icon: "book",
        link: "/md/design/"
    },
    {
        text: "性能优化",
        icon: "chart-simple",
        link: "/md/performance/"
    },
    {
        text: "Java",
        icon: "chart-simple",
        children: ["/md/java/concurrent/README.md"]
    },
    {
        text: "Spring",
        icon: "seedling",
        children: ["/md/spring/springboot/README.md"]
    }
]);
