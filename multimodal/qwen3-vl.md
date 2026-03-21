# Qwen3-VL 学习笔记

## contributions

- interleaved-MRoPE
- DeepStack in ViT
- textual timestamp in video
- square-root reweighting，提高多模态能力的同时不损失文本能力
- 256K context length 预训练
- 后训练增加 thinking & no thinking 两种
- MoE & Dense（主要是语言模型有这种规格）

### Interleaved-MRoPE

在 Qwen2.5 中，对于视频，positional embedding 划分为 3 个部分，每个部分分别计算 t/h/w 的位置编码，即：

```text
tttt...hhhh....www.....
```

作者观察到这样会导致频率谱不均衡。  
所以 Qwen3-VL 改成了交错的 MRoPE，即 positional embedding 的每个位置轮流计算 thw，即：

```text
thwthwthw...
```

### DeepStack

ViT 中不同层的视觉 token，残差连接到相应的 LLM 层。  
消融实验证明有效。

### textual timestamp

取消 Qwen2.5-VL 中的绝对时间对齐，直接用文本表示时间戳，`HH:MM:SS` 和 `4.0s` 两种格式。

### training data

如何筛选不同难度的数据？

- base 模型（没训的模型）就能答对的数据太简单，可以不要。
- 多模态必要性：如果单文本模态就能解决问题，也不要。

蒸馏：先做离线蒸馏（数据蒸馏）再做在线蒸馏，最小化与 teacher 模型的 KL 散度。

### training pipeline

**预训练**分为四个阶段：热身对齐阶段（仅更新视觉语言投影层，冻结模型其余部分），随后是全参数训练，其上下文窗口逐步扩大到 `8K`、`32K` 和 `256K`。  
**后训练**包括三个阶段：

- 针对长思维链数据的监督微调；
- 来自更强教师模型的知识蒸馏；
- 强化学习。

### benchmark

通用视频理解（VideoMME, MVBench）、时间视频接地（Charades-STA）、视频推理（VideoMMMU, MMVU）以及长视频理解（LVBench, MLVU）。

## 代码

### processor

processor 主要针对视频和图像，进行以下操作：

- 图像 resize 到最近的 patch 倍数尺寸（`smart_resize` 函数）
- 切分 patch，整理 shape，返回 data（dict，包含 `pixel_values` 和 `grid_thw`）
    - `pixel_values` 一般是 `num_patches * num_pixels`，前者是视觉 token 数目，后者是每个视觉 token 对应 patch 在原始图像/视频中占的像素值个数，一般是 `3(rgb) * 2(t_patch_size) * 16(patch_size) * 16(patch_size) = 1536`
    - `grid_thw` 是三个数字，代表 t/h/w 三个维度上的 patch 数目（token 数目）
- 文本部分过 tokenizer，进行分词得到 token_id
- processor 完成后，一般得到 inputs：
    - `input_ids`（text + vision）
    - `attention_masks`（这里指 padding_mask，batch 内不同长度样本会左 padding，causal mask 是在 TextModel 中添加的）
    - `pixel_values`
    - `grid_thw`

```python
for item in batch:
    message = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "image": image,
                },
                {
                    "type": "text",
                    "text": self.prompt_stage_filter,
                },
            ],
        },
    ]
    messages.append(message)
```

### vision model

```python
inputs = self.processor.apply_chat_template(
    messages,
    tokenize=True,
    add_generation_prompt=True,
    return_dict=True,
    return_tensors="pt",
    padding=True,  # padding should be set for batch generation!
)
inputs = inputs.to(self.model.device)
```

- patch_embed（输入是 `pixel_values`）
    - 将 `pixel_values` 先 view 成 `N * C * T * H * W`
    - 然后做 `Conv3d(C, H)`，`H=hidden_size`，`kernel_size == patch_size == stride_size`
    - 所以做完之后，是 `N * H * 1 * 1 * 1`，最后 view 成 `N * H`：`hidden_states`
    - 注意，这里的 N 内部是按照 `2 * 2 (merge_size=2)` 内部先排列，然后遍历每 4 个的顺序
- fast_pos_embed_interpolate（输入是 `grid_thw`）
    - 有一个长度为 `num_position_embeddings=2304=48*48` 的查找表 `nn.Embedding(H)`
    - 将 h 和 w 双线性插值到 `48*48`，并按查表结果按权重计算 h 和 w 个 embedding 向量
    - 在 t 维度上进行 repeat 操作
    - 做完之后再 view 回到 `N * H`：`pos_embeds`
    - 结果相加 `hidden_states = hidden_states + pos_embeds`，这是将要进入每个 block 的 `hidden_states`
    - 注意，这个绝对的空间位置编码仅使用一次：在进入每个 block 之前，加在算完卷积的特征上
- rot_pos_emb（输入是 `grid_thw`）
    - 获得 `pos_ids`，对每个 token 查看其在 h 和 w 方向上的位置下标 `row_idx` 和 `col_idx`
    - t 维度上 repeat，得到 `N * 2` 的 `pos_ids`
    - 使用每个 `pos_ids=[row_idx, col_idx]`，在 `RotaryEmbedding(head_dim // 2)` 查找表中，用 `row_idx` 和 `col_idx` 分别查到旋转向量，然后拼接
    - 得到 `rotary_pos_emb: [seq_len * head_dim]`（某种相位）
    - 计算 cos 和 sin 值，在之后每个 block 都用来旋转 q 和 k
- VisionBlock-attn（输入是 `hidden_states: [seq_len, hidden_dims]`）
    - 计算 `LayerNorm(hidden_size)`
    - 计算 qkv，分别都是 `seq_len * num_heads * head_dims`
    - 应用 RoPE（需要在 fp32 上计算），两两一组乘以旋转矩阵（cos 和 sin 构造而来），得到旋转后的 q 和 k
- 计算 attn_weights（只做帧内注意力，帧与帧之间不算，通过 cu_seqlen 保证）
    - 如果是 `flash_attention_2` 接口，会将所有帧（t 维度）的 token 拼接到一起去做 attention，用 cu_seqlen 信息保证只有帧内做注意力
    - 如果是 eager 接口，就先按 cu_seqlen 划分每一帧出来，再做帧内注意力
    - 注意帧内都是 full attention，没有 causal mask
- 上述两种 attn 实现都直接输出 `attn_weights * V` 的结果
- 做 output_project，然后残差连接，得到 `hidden_states`
- VisionBlock-mlp（输入是 `hidden_states: [seq_len, hidden_dims]`）
    - 计算 `LayerNorm(hidden_size)`
    - `Linear(hidden_size, intermediate_size)` 升维，一般升到 4 倍
    - 激活函数 gelu
    - `Linear(intermediate_size, hidden_size)` 降维回到原维度
    - 计算残差连接，得到 `hidden_states`
- PatchMerger（输入是中间层或最后一层的 `hidden_states`，中间层是 deepstack 机制）
    - 中间层：先将 4 个 token 拼成一个向量，再做 norm
    - 最后层：先做 norm，再把 4 个向量拼成一个向量
    - `Linear(hidden_size, hidden_size) + 激活 + Linear(hidden_size, out_hidden_size)`
    - 1 和 2 是实际在做 merge，3 是 MLP 连接器
- 整理
    - 准备 `input_embeds`：把 `inputs_embeds` 中 vision 占位符的位置替换为 vision model 实际算出的 `vision_embeds`
    - 准备 `vision_pos_mask` 和 `deepstack_visual_embeds`：如果同时有视频和图像，需要将 `deepstack_vision_embeds` 拼接到一起；单图像和单视频不用特殊处理
    - 准备 `position_ids`：MRoPE 策略
        - prefill 阶段，对 text/image/video 分别给 thw 的 `position_ids`，额外记录一个 `mrope_position_deltas`，值为当前 `pos_id` 的最大编号减去 padding 后 token 数目；为了记录当前最大 `position_ids` 编号，方便后面 decoding 阶段从这里累加。padding 部分的 thw 都默认是 1。
        - decoding 阶段，直接在 `mrope_position_deltas` 基础上，结合 kv-cache 的 `seq_len`，为将要生成的 next token 分配 `pos_id`
        - 例子：2 个左 padding 位，3 个文本 token，4（2x2）个 image token，8（2x2x2）个 video token，在 prefill 完成之后的 `pos_id`：

```text
t [1,1, 0,1,2, 3,3,3,3, 7,7,7,7,8,8,8,8]
h [1,1, 0,1,2, 3,3,4,4, 7,7,8,8,7,7,8,8]
w [1,1, 0,1,2, 3,4,3,4, 7,8,7,8,7,8,7,8]
```

此时的 `mrope_position_deltas` 是 `8 - 17 = -9`。

---

### TextModel

- 输入信息有以下几个部分：
    - `position_ids`
    - `attention_mask`（具体是左 padding 的 mask）
    - `past_key_values`（kv-cache）
    - `inputs_embeds`（包含视觉文本 embeddings）
    - `cache_position`（当前已经做了几步解码）
    - `visual_pos_masks`（标记哪些位置是视觉部分）
    - `deepstack_visual_embeds`（ViT 某些层拿到的 embedding）
- 添加 `causal_mask`，更新 `attention_mask`：pad 行列全 0，其余部分下三角矩阵
- MRoPE
    - 先分别计算 thw 三个数字对应的 freqs 向量
    - 将 pos_id 从 `[TTT...HHH...WWW]` 转成 interleaved `[THTHWHTHW...TT]`，按这个排列顺序将对应 freqs 填进来
    - thw 三者的分配比例是 `[24, 20, 20]`，先按 thw 交替做，多余的 t 都在最后
    - 得到的 `position_embeddings` 会在后续每个 decoder layer 使用
- Attention
    - 有 pre-norm，是 RMSNorm，在 hidden_dim 维度上做
    - 支持传入 `num_attention_heads`，可支持 MHA / GQA / MQA
    - 做了 qk norm，在 head_dim 维度内做 RMSNorm
    - kv-cache 更新，有一个 Cache 类，有 `update` 方法
    - 最后做残差连接
- FFN
    - 有 pre-norm，代码里写的是 post-attn-layernorm
    - 非 moe 版本：普通 SwiGLU，`down_proj(act_fn(gate_proj(x) * up_proj(x)))`，一般 up 到 `4 * hidden_size`，down 回 `hidden_size`
    - moe 版本：
        - `Linear(hidden_size, num_experts)` 获得每个专家的 logits
        - softmax 后选 topk 个专家，k 个专家再归一化，得到每个专家权重
        - 专家网络是 SwiGLU 的 FFN，每个专家是 `down_e(act_fn(gate_e(x) * up_e(x)))`，一般 up 到 `hidden_size`，down 回 `moe_intermediate_size`
        - 实际运行时，会把不同 token 分配给不同专家，每个专家收集要处理的若干 token，一起处理。训练和推理时表现不同：
            - 训练时：只计算当前 batch 的 token 分配给的那些专家，for 循环每个专家，同时处理多个 token
            - 推理时：所有专家都计算，每个专家并行做 FFN，然后所有专家加权求和（实际上大多数专家权重是 0）
        - 为什么这么做？
            - 训练时这样省显存，能拉大 batch size
            - 推理时这样更快，减少 latency
    - 最后做残差连接
- deepstack_process
    - 指定层才做，把之前存好的 vision embedding 以残差连接方式加在当前 vision 部分的 `hidden_states` 上
- head
    - 做下一个 token 预测：`nn.Linear(hidden_size, vocab_size)`。
