#!/bin/bash
set -e

# NAS部署脚本
# 用法: ./deploy-to-nas.sh [password]

NAS_USER="ThomasLee"
NAS_HOST="192.168.31.92"
NAS_PATH="/volume1/docker/my-site"
IMAGE_FILE="my-site-amd64.tar.gz"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== NAS部署脚本 ===${NC}"

# 检查必要文件
if [ ! -f ".env.local" ]; then
    echo -e "${RED}错误: .env.local 文件不存在${NC}"
    exit 1
fi

if [ ! -f "docker-compose.nas.yml" ]; then
    echo -e "${RED}错误: docker-compose.nas.yml 文件不存在${NC}"
    exit 1
fi

if [ ! -f "$IMAGE_FILE" ]; then
    echo -e "${YELLOW}警告: $IMAGE_FILE 不存在，将跳过镜像上传${NC}"
    SKIP_IMAGE=true
fi

# 获取密码
if [ -n "$1" ]; then
    NAS_PASSWORD="$1"
elif [ -n "$NAS_PASSWORD" ]; then
    echo "使用环境变量 NAS_PASSWORD"
else
    echo -n "请输入NAS密码: "
    read -s NAS_PASSWORD
    echo
fi

# 上传配置文件
echo -e "${GREEN}[1/3] 上传配置文件...${NC}"
cat > /tmp/upload_configs.exp << EOF
#!/usr/bin/expect -f
set timeout 60
spawn rsync -avz .env.local docker-compose.nas.yml ${NAS_USER}@${NAS_HOST}:${NAS_PATH}/
expect {
    "yes/no" { send "yes\r"; exp_continue }
    "password:" { send "${NAS_PASSWORD}\r" }
}
expect eof
EOF
chmod +x /tmp/upload_configs.exp
/tmp/upload_configs.exp
rm /tmp/upload_configs.exp

# 上传镜像（如果存在）
if [ "$SKIP_IMAGE" != "true" ]; then
    echo -e "${GREEN}[2/3] 上传Docker镜像 ($IMAGE_FILE)...${NC}"
    cat > /tmp/upload_image.exp << EOF
#!/usr/bin/expect -f
set timeout 300
spawn rsync -avz --progress ${IMAGE_FILE} ${NAS_USER}@${NAS_HOST}:${NAS_PATH}/
expect {
    "yes/no" { send "yes\r"; exp_continue }
    "password:" { send "${NAS_PASSWORD}\r" }
}
expect eof
EOF
    chmod +x /tmp/upload_image.exp
    /tmp/upload_image.exp
    rm /tmp/upload_image.exp
else
    echo -e "${YELLOW}[2/3] 跳过镜像上传${NC}"
fi

# 显示部署命令
echo -e "${GREEN}[3/3] 上传完成！${NC}"
echo
echo -e "${YELLOW}请SSH到NAS执行以下命令完成部署：${NC}"
echo
echo "  ssh ${NAS_USER}@${NAS_HOST}"
echo "  cd ${NAS_PATH}"
if [ "$SKIP_IMAGE" != "true" ]; then
    echo "  docker load < ${IMAGE_FILE}"
fi
echo "  docker rm -f my-site 2>/dev/null || true"
echo "  docker-compose -f docker-compose.nas.yml up -d"
echo
echo -e "${GREEN}部署完成后访问: http://${NAS_HOST}:3000${NC}"
