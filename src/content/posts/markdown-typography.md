---
title: Markdown 排版速查
description: '把常用的 Markdown 元素集中放在一页，既是写作时的备忘，也是检查排版效果的样板间。'
pubDate: 2026-06-18
category: 指南
tags: [Markdown, 排版, 写作]
cover: ../../assets/sample-cover.jpg
coverAlt: 抽象的排版示意图
---

这篇文章把日常写作会用到的排版元素都摆了出来。修改样式之后回到这一页，能一眼看出哪里出了问题。

## 段落与强调

中文排版的行高比英文更需要余量，正文使用 1.85 倍行高和 17px 字号，一行大约容纳三十六个汉字，这是长时间阅读时比较不容易串行的密度。

可以给文字加**粗体**、*斜体*，或者标记 `行内代码`。也支持 ~~删除线~~ 和上标脚注[^1]。链接会带有克制的下划线，比如[Astro 官方文档](https://docs.astro.build)，鼠标移上去才会变色。

[^1]: 脚注会自动收集到文章末尾，编号也是自动生成的。

## 标题层级

文章正文从二级标题开始，一级标题留给文章本身。

### 三级标题

三级标题不带下划线，靠字号和间距区分层级。目录默认收录二级和三级标题。

#### 四级标题

四级标题的字号已经接近正文，一般不建议用得更深。

## 列表

无序列表：

- 第一项
- 第二项
  - 嵌套的子项
  - 另一个子项
- 第三项

有序列表：

1. 先做这个
2. 再做那个
3. 最后收尾

任务列表：

- [x] 已经完成的事
- [ ] 还没做的事
- [ ] 也许永远不会做的事

## 引用

> 过早的优化是万恶之源。但这句话常常被断章取义 —— 原文接下来还说，我们不应该放过那关键的百分之三。
>
> 引用块可以有多个段落。

## 代码

行内代码写成 `npm run build` 这样。代码块支持语法高亮，浅色和深色模式各有一套配色：

```ts
interface Post {
  title: string;
  pubDate: Date;
  tags: string[];
}

function sortByDate(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}
```

命令行：

```bash
npm install
npm run dev
npm run build
```

配置文件：

```json
{
  "name": "astro-blog",
  "scripts": {
    "build": "astro build"
  }
}
```

鼠标移到代码块上，右上角会出现复制按钮。

## 表格

| 方案 | 首屏 JS | 搜索 | 评论 |
| --- | ---: | :---: | --- |
| 纯静态 HTML | 0 KB | 无 | 无 |
| Astro + Pagefind | 约 2 KB | 全文 | Giscus |
| 单页应用 | 100 KB 起 | 全文 | 自建 |

表格支持对齐方式，列比较多时可以横向滚动。

## 分隔线

---

分隔线用来切开不相关的段落。

## 图片

放在 `public/` 下的图片用相对于页面的路径引用，这样部署到子目录时也不会断链。配上说明文字的写法：

<figure>
  <img src="../../og-default.svg" alt="站点的默认分享图" width="600" height="315" />
  <figcaption>用 figure 和 figcaption 可以给图片加说明</figcaption>
</figure>

## 键盘按键

保存用 <kbd>Ctrl</kbd> + <kbd>S</kbd>，搜索按 <kbd>/</kbd> 就能聚焦输入框。

## 中英文混排

在中文段落里混入 English words 和数字 2026 时，浏览器不会自动加间距。写作时如果觉得挤，可以手动在中英文之间留一个空格 —— 这篇文章里就是这么做的。
