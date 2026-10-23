// UserPromptSubmit 钩子：用户的话涉及视频时，提醒先调用 motioner 技能。
// 之前三个视频都没调用它，只靠 CLAUDE.md 和记忆不够稳，这里每次提问都检查一遍。
// 输入是 Claude Code 传来的 JSON（含 prompt），输出 additionalContext 给模型看。

// 声音、节奏也算：CLAUDE.md 里改声音同样要先调技能。"重做"多半是重做某个片子，只说表情的会被下面排除
const VIDEO =
  /视频|片子|成片|短片|动画|分镜|转场|镜头|动效|画面|配乐|音效|声音|音乐|BGM|节拍|节奏|卡点|片头|片尾|封面|重做|渲染|B\s*站|bilibili|video|composition|remotion/i;
const STICKER = /表情/;

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let prompt = "";
  try {
    prompt = JSON.parse(raw).prompt ?? "";
  } catch {
    // 输入不是 JSON 时什么都不做，不挡住用户的提问
    process.exit(0);
  }

  // 只说表情、没提视频的，不提醒
  if (!VIDEO.test(prompt) || (STICKER.test(prompt) && !/视频|片子|成片/.test(prompt))) {
    process.exit(0);
  }

  const context = [
    "【CodeVideo 提醒】这条消息涉及视频。如果要新做视频，或改视频的画面、动效、转场、声音：",
    "1. 先用 Skill 工具调用 anthropic-skills:motioner（这个对话里已经调用过就不用重复），排在提问、写方案、读代码之前；",
    "2. 方案开头先写概念四行（种子物体 / 章节动词 / 变成链 / 首尾呼应）和节拍；",
    "3. 交付前跑 npm run review（技能的转场审查 + 音效对帧），逐个转场写结论。",
    "只是问问题、改错字、换配音这类不碰画面的事，忽略这条提醒。详见 CLAUDE.md「做视频先调技能」。",
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context },
    }),
  );
});
