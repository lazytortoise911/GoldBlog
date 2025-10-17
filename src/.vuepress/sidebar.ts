import {sidebar} from "vuepress-theme-hope";

export default sidebar({
    "/": [
        "",
        {
            text: "个人简历",
            icon: "laptop-code",
            link: "/md/resume"
        },
    ],
    "/md/design/": [
        {
            text: "设计模式",
            icon: "compass-drafting",
            prefix: "/md/design/",
            children: [
                "Singleton.md",
                "Factory.md"
            ]
        }
    ],
    "/md/dev-log/": [
        {
            text: "开发日志",
            icon: "laptop-code",
            prefix: "/md/dev-log/",
            children: [
                "day01.md",
                "day02.md",
                "day03.md",
                "day04.md",
                "day05.md",
                "day06.md",
                "day07~day08.md",
                "day09~day10.md",
                "day11.md",
                "day12.md"
            ],
        }
    ],
    "/md/performance/": [
        {
            text: "性能优化",
            icon: "chart-simple",
            prefix: "/md/performance/",
            children: [
                "Performance00.md",
                "Performance04.md",
                "Performance05.md",
                "Performance06.md",
                "Performance07.md",
                "Performance08.md",
                "Performance09.md",
                "Performance10.md",
                "Performance11.md",
                "Performance12.md"
            ]
        }
    ]
});
