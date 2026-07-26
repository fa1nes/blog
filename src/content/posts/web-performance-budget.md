---
title: 给博客定一个性能预算
description: '性能不是优化出来的，是守住的。与其事后做优化，不如一开始就给页面定一条不许越过的线。'
pubDate: 2026-05-09
category: 技术
tags: [性能, 前端, 工程实践]
---

大多数博客在上线那天都是快的。慢是后来发生的事：加了个统计脚本，换了套字体，接入了评论，装了个动画库。每一次都只慢了一点点，一年之后首屏要等三秒。

问题不在于某次改动，而在于**没有一条线告诉你什么时候该停下来**。

## 什么是性能预算

性能预算是一组你提前约定、并且愿意为之拒绝功能的数字。它可以是资源体积，也可以是时间指标：

```text
首屏 HTML          < 15 KB (gzip)
CSS 总量           < 20 KB (gzip)
首屏 JavaScript    < 10 KB (gzip)
网络请求数         < 12
LCP (4G 移动端)    < 1.5s
CLS                < 0.05
```

数字本身不神圣，重要的是它是**事先**定下的。事后定的预算永远等于当前值。

## 静态博客的预算怎么花

一个纯文本博客的首屏，理论上只需要 HTML 和 CSS。所以真正的问题是：那些额外的 KB 都花到哪去了。

### 字体是最大的一笔开销

一套中文 Web 字体动辄几 MB，即使做了子集化也常在 200 KB 以上。而且字体加载会带来 FOIT 或 FOUT，两者都影响体感。

系统字体栈的代价是不同设备上观感略有差异，收益是零请求、零布局抖动：

```css
--font-sans:
  ui-sans-serif, -apple-system, 'Segoe UI', 'PingFang SC',
  'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
```

如果一定要用自定义字体，至少做到三件事：只加载正文一种字重、用 `font-display: swap`、把字体文件放在自己的域名下避免额外的 DNS 与 TLS 握手。

### JavaScript 要按页计算，不是按站计算

「全站 JS 只有 30 KB」是一句没有意义的话。用户打开的是一个页面，不是一个站。

有意义的问法是：*打开一篇文章，浏览器要下载和执行多少 JavaScript？*

在这套主题里，一篇文章页的脚本大致是这样分布的：

| 功能 | 体积 | 是否必须 |
| --- | ---: | --- |
| 主题初始化（内联） | 约 0.2 KB | 是，防止深色模式闪白 |
| 主题切换按钮 | 约 0.3 KB | 否，可在配置里关掉 |
| 目录滚动高亮 | 约 0.8 KB | 否 |
| 代码块复制 | 约 0.6 KB | 否 |
| 搜索 | 0 KB | 只在搜索页加载 |
| 评论 | 0 KB | 滚动到评论区才加载 |

关键不是每一项多小，而是**每一项都能被单独关掉**，并且默认不在不需要它的页面上出现。

### 第三方脚本要算总账

一个常见的错觉是「统计脚本只有 5 KB」。实际成本包括：DNS 解析、TLS 握手、脚本下载、解析执行、以及它自己发起的后续请求。在移动网络上，一个第三方域名的首次连接本身就要 200ms 以上。

如果需要访问统计，优先选择服务端日志分析，或者由托管平台提供的、不需要在页面里插脚本的方案。

## 让预算自动生效

写在文档里的预算会被忘记，写在 CI 里的不会。

最轻量的做法是在构建后检查产物体积：

```js
// scripts/check-budget.mjs
import { readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

const LIMITS = { '.css': 20_480, '.js': 10_240 };

const files = await readdir('dist/_astro');
let failed = false;

for (const file of files) {
  const ext = file.slice(file.lastIndexOf('.'));
  const limit = LIMITS[ext];
  if (!limit) continue;

  const gzipped = gzipSync(await readFile(`dist/_astro/${file}`)).length;
  if (gzipped > limit) {
    console.error(`${file}: ${gzipped} B 超出预算 ${limit} B`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
```

然后挂到构建流程里：

```bash
npm run build && node scripts/check-budget.mjs
```

更完整的方案可以用 Lighthouse CI，它能同时约束体积和 Core Web Vitals，并在 Pull Request 上留下评论。

## 什么时候可以超支

预算不是禁令，是一个需要解释的门槛。

如果一个功能确实值得，超支是可以接受的 —— 前提是你**明确知道自己在花钱买什么**。比如为了支持数学公式而引入 KaTeX 的样式表，这是一次有意识的交易，而不是一次意外。

真正危险的从来不是那些经过讨论的超支，而是那些没人注意到的累积。
