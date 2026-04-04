import { Output, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import type { AssetRecord, EntityRecord } from "@/server/mvp/types";
import { resolveTextModel } from "@/server/mvp/vendors";

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function fallbackEntities(sourceText: string): { entities: Array<{ type: "character" | "scene" | "prop"; name: string; description: string; prompt: string }>; summary: string } {
  const tokens = uniq(
    (sourceText.match(/[\u4e00-\u9fa5]{2,4}|[A-Za-z][A-Za-z0-9_-]{2,}/g) ?? [])
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  ).slice(0, 12);

  const characters = tokens.slice(0, 3).map((name, idx) => ({
    type: "character" as const,
    name,
    description: `角色${idx + 1}，从原文中识别的关键人物。`,
    prompt: `cinematic portrait of ${name}, dramatic lighting, high detail`,
  }));

  const scenes = [
    {
      type: "scene" as const,
      name: "主要场景",
      description: "故事的主要推进空间。",
      prompt: "cinematic location, atmospheric, moody, storytelling composition",
    },
  ];

  const props = [
    {
      type: "prop" as const,
      name: "关键道具",
      description: "推动剧情转折的核心物件。",
      prompt: "hero prop close-up, cinematic still life, rich texture",
    },
  ];

  return {
    entities: [...characters, ...scenes, ...props],
    summary: `已从原文中识别 ${characters.length + scenes.length + props.length} 个基础实体。`,
  };
}

async function runStructuredObject<TSchema extends z.ZodTypeAny>(input: {
  modelRef?: string;
  instructions: string;
  prompt: string;
  schema: TSchema;
  temperature?: number;
}): Promise<{ output: z.infer<TSchema>; modelRef: string; text: string }> {
  const resolved = resolveTextModel(input.modelRef);
  const output = Output.object({ schema: input.schema });
  const agent = new ToolLoopAgent({
    model: resolved.languageModel,
    instructions: input.instructions,
    temperature: input.temperature ?? 0.3,
    stopWhen: stepCountIs(8),
    output,
  });

  const result = await agent.generate({
    prompt: input.prompt,
  });

  return {
    output: result.output as z.infer<TSchema>,
    modelRef: resolved.modelRef,
    text: result.text,
  };
}

const entitySchema = z.object({
  summary: z.string(),
  entities: z.array(
    z.object({
      type: z.enum(["character", "scene", "prop"]),
      name: z.string(),
      description: z.string(),
      prompt: z.string(),
    }),
  ),
});

const scriptSchema = z.object({
  strategy: z.string(),
  outline: z.array(z.string()),
  scriptText: z.string(),
});

const assetsSchema = z.object({
  assets: z.array(
    z.object({
      type: z.enum(["character", "scene", "prop"]),
      name: z.string(),
      description: z.string(),
      prompt: z.string(),
    }),
  ),
});

const storyboardSchema = z.object({
  shots: z.array(
    z.object({
      title: z.string(),
      action: z.string(),
      dialogue: z.string(),
      prompt: z.string(),
      durationSeconds: z.number().min(1).max(15),
      assetRefs: z.array(z.string()),
    }),
  ),
});

export async function generateEpisodeEntities(input: {
  sourceText: string;
  modelRef?: string;
}): Promise<{ summary: string; entities: Array<{ type: "character" | "scene" | "prop"; name: string; description: string; prompt: string }>; modelRef: string }> {
  try {
    const result = await runStructuredObject({
      modelRef: input.modelRef,
      instructions:
        "你是短剧制作的实体识别助手。只抽取对制作有价值的角色、场景、道具，并生成可用于后续资产生成的描述和提示词。",
      prompt: `请从以下小说内容中识别实体：\n\n${input.sourceText}`,
      schema: entitySchema,
      temperature: 0.2,
    });

    return {
      summary: result.output.summary,
      entities: result.output.entities,
      modelRef: result.modelRef,
    };
  } catch {
    const fallback = fallbackEntities(input.sourceText);
    return {
      ...fallback,
      modelRef: "fallback:heuristic",
    };
  }
}

export async function generateEpisodeScript(input: {
  sourceText: string;
  entities: EntityRecord[];
  modelRef?: string;
}): Promise<{ strategy: string; outline: string[]; scriptText: string; modelRef: string }> {
  const entityHint = input.entities.map((item) => `${item.type}:${item.name}`).join("、");

  try {
    const result = await runStructuredObject({
      modelRef: input.modelRef,
      instructions:
        "你是短剧编剧 Agent。你要输出可执行剧本（含分场和对白），并保证节奏适合短剧分镜化。",
      prompt: `原文：\n${input.sourceText}\n\n实体：${entityHint}\n\n请生成改编策略、剧情大纲和完整剧本文本。`,
      schema: scriptSchema,
      temperature: 0.35,
    });

    return {
      ...result.output,
      modelRef: result.modelRef,
    };
  } catch {
    const outline = ["开场冲突", "关系升级", "反转爆发", "悬念收束"]; // fallback
    return {
      strategy: "保持冲突驱动，单场景集中推进，结尾保留钩子。",
      outline,
      scriptText: outline.map((item, index) => `场${index + 1}：${item}\n人物对白与动作描述待导演细化。`).join("\n\n"),
      modelRef: "fallback:heuristic",
    };
  }
}

export async function generateEpisodeAssets(input: {
  entities: EntityRecord[];
  scriptText: string;
  modelRef?: string;
}): Promise<{ assets: Array<{ type: "character" | "scene" | "prop"; name: string; description: string; prompt: string }>; modelRef: string }> {
  const entityBlock = input.entities
    .map((entity) => `- ${entity.type}: ${entity.name} (${entity.description})`)
    .join("\n");

  try {
    const result = await runStructuredObject({
      modelRef: input.modelRef,
      instructions: "你是资产设计 Agent。请输出角色、场景、道具的可执行资产定义和生成提示词。",
      prompt: `剧本：\n${input.scriptText}\n\n实体：\n${entityBlock}\n\n输出资产定义。`,
      schema: assetsSchema,
      temperature: 0.25,
    });

    return {
      assets: result.output.assets,
      modelRef: result.modelRef,
    };
  } catch {
    return {
      assets: input.entities.map((entity) => ({
        type: entity.type,
        name: entity.name,
        description: entity.description,
        prompt: entity.prompt,
      })),
      modelRef: "fallback:heuristic",
    };
  }
}

export async function generateEpisodeStoryboards(input: {
  scriptText: string;
  assets: AssetRecord[];
  modelRef?: string;
}): Promise<{ shots: Array<{ title: string; action: string; dialogue: string; prompt: string; durationSeconds: number; assetRefs: string[] }>; modelRef: string }> {
  const assetsHint = input.assets.map((asset) => `${asset.name}(${asset.type})`).join("、");

  try {
    const result = await runStructuredObject({
      modelRef: input.modelRef,
      instructions: "你是分镜导演 Agent。你要把剧本拆为可执行镜头，给出动作、对白、提示词、时长和关联资产。",
      prompt: `剧本：\n${input.scriptText}\n\n可用资产：${assetsHint}\n\n请生成分镜列表。`,
      schema: storyboardSchema,
      temperature: 0.3,
    });

    return {
      shots: result.output.shots,
      modelRef: result.modelRef,
    };
  } catch {
    const names = input.assets.slice(0, 3).map((asset) => asset.name);
    return {
      shots: [
        {
          title: "镜头 1",
          action: "建立场景与人物关系，镜头平稳推进。",
          dialogue: "（旁白）冲突即将开始。",
          prompt: "cinematic establishing shot, dramatic atmosphere, controlled camera movement",
          durationSeconds: 3,
          assetRefs: names,
        },
        {
          title: "镜头 2",
          action: "核心对峙动作，情绪拉高。",
          dialogue: "角色A：我们没有退路。",
          prompt: "medium shot confrontation, tension, expressive faces, cinematic lighting",
          durationSeconds: 4,
          assetRefs: names,
        },
      ],
      modelRef: "fallback:heuristic",
    };
  }
}
