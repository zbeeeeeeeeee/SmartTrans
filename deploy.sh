#!/usr/bin/env bash
set -euo pipefail

# ===== SmartTrans 多实例部署脚本 =====
# 用法：./deploy.sh [实例数] [起始端口]
# 示例：./deploy.sh 20 28123   # 部署 20 个实例，端口 28123~28142
#       ./deploy.sh 3  28123   # 部署 3 个测试实例

COUNT=${1:-20}
BASE_PORT=${2:-28123}

# ── 前置检查 ──────────────────────────────────────────────
if [ ! -f server/.env ]; then
  echo "❌ 缺少 server/.env 文件，请先配置环境变量："
  echo "   cp server/.env.example server/.env"
  echo "   然后编辑 server/.env 填入 API key"
  exit 1
fi

# ── 加载环境变量到当前 shell（PM2 启动时需要）─────────────
set -a
source server/.env
set +a

echo "===== 部署配置 ====="
echo "实例数:    $COUNT"
echo "端口范围:  $BASE_PORT ~ $((BASE_PORT + COUNT - 1))"
echo ""

# ── 1. 安装依赖 & 构建（所有实例共享同一份代码）───────────
echo "===== 1/4 安装依赖 ====="
npm run install:all

echo "===== 2/4 构建前端 ====="
npm run build

# ── 2. 为每个实例创建独立数据目录 & 重建知识库 ─────────────
KNOWLEDGE_SRC="server/data/knowledge"
FONTS_SRC="server/data/fonts"

for ((i = 0; i < COUNT; i++)); do
  port=$((BASE_PORT + i))
  data_dir="server/data-${port}"

  echo ""
  echo "===== 3/4 实例 ${port} (${i}/$((COUNT - 1))) 初始化 ====="

  mkdir -p "${data_dir}/uploads" \
           "${data_dir}/knowledge" \
           "${data_dir}/fonts" \
           "${data_dir}/pdfs" \
           "${data_dir}/skills"

  # 复制知识库源文件（只读模板，每个实例独立向量库）
  if [ -d "$KNOWLEDGE_SRC" ] && [ -n "$(ls -A "$KNOWLEDGE_SRC" 2>/dev/null)" ]; then
    cp -r "${KNOWLEDGE_SRC}/"* "${data_dir}/knowledge/"
    echo "  ✓ 知识库文件已复制"
  else
    echo "  ⚠ ${KNOWLEDGE_SRC} 为空或不存在，跳过知识库复制"
  fi

  # 复制字体（PDF 报告生成用）
  if [ -d "$FONTS_SRC" ] && [ -n "$(ls -A "$FONTS_SRC" 2>/dev/null)" ]; then
    cp -r "${FONTS_SRC}/"* "${data_dir}/fonts/"
  fi

  echo "  构建 RAG 向量库..."
  DATA_DIR="${data_dir}" PORT="${port}" npm run rag:ingest
done

# ── 3. 启动 PM2 ───────────────────────────────────────────
echo ""
echo "===== 4/4 启动 PM2 ====="

# 清理同端口的旧进程
for ((i = 0; i < COUNT; i++)); do
  port=$((BASE_PORT + i))
  pm2 delete "smarttrans-${port}" 2>/dev/null || true
done

INSTANCE_COUNT="${COUNT}" BASE_PORT="${BASE_PORT}" pm2 start ecosystem.config.cjs
pm2 save

# ── 4. 健康检查 ──────────────────────────────────────────
echo ""
echo "===== 健康检查 ====="
sleep 3

FAIL_COUNT=0
for ((i = 0; i < COUNT; i++)); do
  port=$((BASE_PORT + i))
  if curl -s --max-time 3 "http://localhost:${port}/api/health" > /dev/null 2>&1; then
    echo "  ✓ 端口 ${port} — 正常"
  else
    echo "  ❌ 端口 ${port} — 未响应"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
pm2 status
echo ""
echo "===== 部署完成 ====="
echo "实例数: ${COUNT}  |  成功: $((COUNT - FAIL_COUNT))  |  失败: ${FAIL_COUNT}"
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "有实例健康检查未通过，请查看日志：pm2 logs"
fi
