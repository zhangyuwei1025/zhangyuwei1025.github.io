---
layout: article
title: V-JEPA 2 学习笔记 | 多模态理解
description: 围绕 V-JEPA 2 与 V-JEPA 2-AC 的方法、训练数据与下游任务表现整理。
section_url: /multimodal/
section_label: 多模态理解
article_title: V-JEPA 2 学习笔记
article_subtitle: 围绕 V-JEPA 2 与 V-JEPA 2-AC 的方法、训练数据与下游任务表现整理。
article_type: 学习笔记
article_topic: V-JEPA 2
---

## Abstract {#abstract}

- 在超过 `100` 万小时互联网视频与图像数据上进行无动作预训练，得到 `V-JEPA 2`。
- 代表性结果：
  - Something-Something v2：`77.3` Top-1
  - Epic-Kitchens-100：`39.7` Recall@5
  - Video QA（8B 对齐模型）：PerceptionTest `84.0`，TempCompass `76.9`
- 进一步使用不到 `62` 小时 Droid 无标签机器人数据后训练动作条件世界模型 `V-JEPA 2-AC`，实现跨实验室 Franka 机械臂零样本抓取与放置。

核心结论是：互联网规模视频自监督学习 + 少量机器人交互数据，可以得到具备物理世界规划能力的世界模型。

## Introduction {#introduction}

人类可以从观察中构建表征，并预测未来状态；结合动作后，还能预测动作对未来状态的影响并进行规划。对应建模链路可理解为：

- `Observation -> Representation`
- `O_t -> R_t -> R_{t+1}`
- `O_t + A_t -> R_{t+1}`

作者希望解决两个问题：

- 仅依赖机器人状态-动作数据，规模太小；
- 仅依赖互联网视频像素预测，常常更关注视觉细节而非可规划表征。

V-JEPA 2 的关键策略是：在表征空间预测而不是像素空间预测，并采用两阶段训练：

- 第一阶段：无动作预训练（`1M+` 小时视频 + `1M` 图像，约 `1B` 参数编码器）。
- 第二阶段：动作条件预测（约 `0.3B` Transformer，Block-Causal Attention），用少量动作数据建模 `S_t, A_t -> R_{t+1}`。

## Video Pretrain {#video-pretrain}

### 模型方法 {#video-pretrain-method}

- 视频 patch 设置：`2 x 16 x 16`。
- `encoder` 与 `predictor` 都是 ViT。
- 训练时随机遮挡部分 patch：
  - encoder 只处理未遮挡 patch；
  - predictor 处理全部 patch，遮挡部分用可学习 `[MASK]` token 替代。
- 遮挡主要在 `h/w` 维度采样，`t` 维度随之整体遮挡，避免模型仅靠相邻帧泄漏信息。
- 训练目标使用 `L1 loss`。

### Scaling {#video-pretrain-scaling}

- 数据规模：`2.2M -> 22M`。
- 模型规模：`0.3B -> 1B`（ViT-L 到 ViT-g）。
- 训练步数：`9w -> 25.2w`（warmup-constant-decay）。
- 分辨率策略：前期低分辨率短视频，后期高分辨率长视频。

### 训练数据 {#video-pretrain-data}

- 图像数据通过时间维复制到 `16` 帧，与视频联合训练。
- 对 YT1B 做了聚类清洗与分布对齐：
  1. 对全集分镜并提取中间帧特征；
  2. 聚类得到约 `1.5M` 簇；
  3. 丢弃未被高质量数据集覆盖的簇，保留约 `0.21M` 簇（约 `115M` clips）。
- 最终按簇内分布和权重采样。

### 训练 Recipe {#video-pretrain-recipe}

前期低分辨率训练，仅在末阶段提升到 `64` 帧、`384x384`，以显著降低训练算力开销。

## Action-Conditioned World Model {#action-conditioned}

### 训练目标与数据 {#ac-goal-data}

- 在冻结 `V-JEPA 2` 编码器上，训练动作条件预测器，按自回归方式预测未来视频表征。
- 数据来自 Droid，不到 `62` 小时无标签交互数据。
- 动作定义为相邻帧末端执行器状态差分：`a_k = s_{k+1} - s_k`。

### 预测器架构 {#ac-architecture}

- 输入：
  - 视频帧 `x_k`（`4 fps`、`4` 秒、共 `16` 帧）
  - 本体状态 `s_k`（7 维：位置、姿态、夹爪）
  - 动作 `a_k`
- 融合方式：动作、状态、视觉特征分别线性映射到统一维度后按时间交织。
- 模型规模：约 `300M` 参数、`24` 层 Transformer。
- 注意力机制：Block-Causal Attention（块内 full attention，跨块 causal）。
- 输出经线性映射回 encoder 特征维度。

### 损失函数 {#ac-loss}

训练最小化两类 `L1` 损失：

- Teacher-forcing loss：用真实历史输入监督下一帧预测。
- Rollout loss：将模型预测作为后续输入进行短步展开（通常 2 步），缓解误差累积。

编码器在训练中保持冻结。

### 规划方式 {#ac-planning}

通过最小化能量函数进行规划：衡量预测未来特征与目标特征之间的 `L1` 距离；结合 CEM 搜索动作序列，并在执行一步后闭环重规划。

## 下游任务 {#downstream}

### 机器人规划 {#downstream-planning}

- 适配：冻结编码器，仅训练动作条件预测器 `V-JEPA 2-AC`，结合 MPC 在潜空间闭环规划。
- 效果：陌生环境零样本迁移可行，抓取/放置任务成功率高，推理速度相较视频生成路径显著提升。

### 理解-动作分类 {#downstream-classification}

- 适配：冻结编码器，在特征上训练 `4` 层 attentive probe（3 层 self-attn + 1 层 cross-attn）。
- 效果：SSv2 达到 `77.3%` Top-1，在多种外观识别任务也具竞争力。

### 预测-动作预测 {#downstream-anticipation}

- 适配：冻结编码器 + 预训练预测器，再训练 anticipation probe（3 个 learnable query）。
- 效果：Epic-Kitchens-100 达到 `39.7` Recall@5（SOTA）。

### 理解-视频问答 {#downstream-videoqa}

- 适配：将编码器视觉特征投影到 LLM 输入空间，做视觉指令微调。
- 效果：8B 规模在多个 Video QA 基准达到 SOTA（如 PerceptionTest `84.0`、TempCompass `76.9`）。