---
title: "供应链安全中的容器镜像安全管理：流程、策略、规范与落地方法"
date: 2026-07-13
brief: "以容器镜像为可验证发布制品，说明从基础镜像、构建、扫描、SBOM、签名、仓库、准入、运行到退役的安全管理闭环。"
---

# 供应链安全中的容器镜像安全管理：流程、策略、规范与落地方法

容器镜像不是一个普通压缩包，而是源代码、基础操作系统、语言运行时、第三方依赖、构建工具和配置共同形成的发布制品。镜像一旦进入制品仓库并被部署，其内容就成为生产环境实际执行的软件。因此，镜像安全管理的目标不能停留在“上线前扫描一次”，而应覆盖制品从产生到退出使用的完整生命周期，并建立可追溯、可验证、可阻断和可审计的控制链。

NIST SP 800-190 将镜像风险、镜像仓库风险、编排器风险、容器运行时风险和宿主机风险作为容器安全的主要问题域。NIST SSDF 则要求组织把安全实践嵌入软件开发生命周期，而不是在发布末端追加一次检查。两者结合后，镜像管理的基本定位很明确：镜像是软件供应链中的正式交付物，必须像源代码和生产变更一样接受身份、完整性、来源、漏洞和变更控制。

## 镜像管理的意义：回答四个生产问题

一套可执行的镜像安全体系至少要回答以下问题：

1. **这是什么制品**：镜像对应哪个应用、版本、代码提交、构建任务和负责人。
2. **它从哪里来**：基础镜像、依赖、构建平台和构建参数是否经过批准，是否具有可验证的来源证明。
3. **它是否可以运行**：漏洞、恶意文件、密钥、许可证和配置风险是否满足当前环境的准入标准。
4. **它运行在哪里**：哪些集群、节点和业务正在使用该 digest；发现问题后能否快速阻断、替换和回滚。

如果只能按标签查询镜像，无法定位构建来源、当前部署和责任人，那么漏洞扫描即使发现问题，也难以形成有效处置。镜像治理的价值主要体现在缩短影响确认时间、降低未授权制品进入生产的概率、提高漏洞修复和事件响应的确定性。

## 管理对象：标签用于阅读，digest 用于控制

OCI Image Specification 把镜像定义为 manifest、配置和文件系统层的组合，并通过 descriptor 与 digest 标识内容。OCI Distribution Specification 进一步区分了 tag 和 digest：tag 是可移动的人类可读指针，digest 是由内容加密哈希形成的唯一标识。

因此，镜像管理应采用两套标识：

- 标签表达业务语义，例如 `payment-api:2.6.1`、`payment-api:release-20260713`。
- digest 表达不可变对象，例如 `payment-api@sha256:<DIGEST>`。

构建、扫描、签名、准入和部署必须关联同一个 digest。仅用标签串联流程会留下时间差：扫描完成后，标签可能被重新指向另一个镜像，最终部署的内容就不再是已经验证的内容。生产清单可以同时保留版本标签和 digest，但策略判断必须以 digest 为准。

## 生命周期流程：八个控制阶段

### 1. 基础镜像准入

基础镜像决定了操作系统组件、软件包管理器、默认用户、证书和运行时。组织应维护基础镜像目录，而不是允许每个项目任意选择公共镜像。

基础镜像规范至少包括：

- 只允许来自批准仓库和批准命名空间的镜像。
- 固定主版本、发行版和 digest，禁止生产构建直接使用 `latest`。
- 记录维护方、支持周期、升级窗口和停止使用日期。
- 优先选择满足业务需要的最小运行时镜像，删除编译器、包管理缓存、调试工具和无关服务。
- 对停止维护的操作系统或语言运行时设置强制迁移期限。

最小镜像不能代替漏洞管理，但可以减少需要维护和暴露的软件数量。基础镜像更新后，应触发下游镜像重建，而不是等待业务代码发生变化。

### 2. 受控构建

生产镜像应由受控 CI/CD 构建平台产生，不应接收开发者工作站直接推送的制品。构建过程应满足：

- Dockerfile、构建脚本和依赖锁文件进入版本控制并经过评审。
- 构建使用最小权限的短期身份，不把长期仓库凭据写入镜像层。
- 密钥通过构建平台的 secret mount 或等价机制临时提供，构建结束后不可出现在 layer、history、环境变量或日志中。
- 编译阶段与运行阶段分离，使用多阶段构建减少运行镜像内容。
- 构建器版本、基础镜像 digest、源代码提交和构建参数进入 provenance。
- 同一发布只产生一个可晋级 digest，不在测试、预发和生产阶段重复构建。

SLSA v1.2 把 provenance 定义为描述软件制品在何处、何时、如何产生的可验证信息。其价值不只是保存一份构建记录，而是让验证方能够判断制品是否由批准的构建平台、批准的代码来源和批准的流程产生。

### 3. 生成 SBOM 与来源证明

每个生产镜像应生成软件物料清单（SBOM），至少包含操作系统包、语言依赖、版本、包标识和许可证信息。SBOM 应与镜像 digest 绑定，并作为 OCI artifact、attestation 或受控制品记录保存。

SBOM 的主要用途包括：

- 新漏洞披露后，快速查询受影响镜像，而不必重新解压全部制品。
- 确认同名软件在不同镜像中的版本和来源。
- 支持许可证、第三方组件和停止维护组件治理。
- 为事件响应提供当时构建内容的证据。

SBOM 不能证明制品未被篡改，也不能证明构建过程可信。因此还需要签名和 provenance；三者分别回答“包含什么”“由谁确认”“如何产生”。

### 4. 分层扫描与风险判定

扫描范围不应只覆盖操作系统 CVE。生产门禁通常需要组合以下检查：

- 操作系统软件包和语言依赖漏洞。
- 镜像层中的密钥、令牌、私钥和敏感配置。
- 恶意文件、异常二进制和未经批准的软件。
- Dockerfile 与镜像配置问题，例如默认 root 用户、危险 capability、开放调试端口。
- SBOM 完整性、许可证和组件停止维护状态。

风险判定不宜只看 CVSS 分数。可利用性、是否存在修复版本、组件是否在运行路径、网络暴露、业务等级和补偿控制都会影响处置优先级。建议把结果分为三类：

- **阻断**：存在可利用的严重漏洞、有效密钥、恶意文件、未批准基础镜像或缺少必要证明。
- **限期修复**：风险可暂时接受，但必须有责任人、到期时间和补偿控制。
- **观察**：暂无修复版本或不在执行路径，继续监测并在条件变化时重新评估。

镜像入库时扫描一次还不够。漏洞数据库持续变化，已经运行数月的 digest 也可能出现新风险。仓库应定期重扫存量镜像，并把新结果关联到当前部署清单。

### 5. 签名与证明验证

签名用于确认镜像 digest 与受信任身份之间的关系。Sigstore Cosign 支持密钥签名和基于 OIDC 身份的 keyless 签名；验证时应同时限定签名者身份和 OIDC issuer，不能只判断“存在某个签名”。Cosign 的签名载荷包含镜像 digest，默认验证会检查该 digest 是否与目标镜像一致。

以下示例展示一条最小发布链。域名、仓库和身份均已脱敏，实际环境还应固定工具版本并保存扫描报告：

```bash
set -euo pipefail
IMAGE="registry.example.com/prod/payment-api"
TAGGED_REF="$IMAGE:$GIT_COMMIT"

docker buildx build --push --tag "$TAGGED_REF" .
DIGEST="$(docker buildx imagetools inspect "$TAGGED_REF" --format '{{json .Manifest.Digest}}' | tr -d '"')"
IMMUTABLE_REF="$IMAGE@$DIGEST"

trivy image --scanners vuln,secret --severity HIGH,CRITICAL --exit-code 1 "$IMMUTABLE_REF"
cosign sign --yes "$IMMUTABLE_REF"
cosign verify "$IMMUTABLE_REF" \
  --certificate-identity-regexp='^https://github.com/<ORG>/<REPO>/' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com'
```

验证应在制品晋级和部署准入时重新执行。CI 中“签名成功”的日志不能代替目标环境的独立验证。

### 6. 制品仓库治理

制品仓库是镜像供应链的控制面，应至少落实：

- 生产仓库与开发缓存仓库分离，跨环境通过晋级而不是重新构建。
- 仓库访问使用最小权限和短期凭据；构建账号只写指定命名空间，运行环境原则上只读。
- 生产标签开启不可变策略，删除和覆盖操作需要审批并保留审计记录。
- 对 manifest、blob、签名、SBOM 和 provenance 采用一致的保留与复制策略。
- 配置跨区域备份、完整性校验和恢复演练。
- 清理策略以“未部署、无保留要求、超过观察期”为条件，不能只按上传时间删除。

OCI Distribution Specification 的内容寻址和 referrers 机制为镜像、签名与其他关联制品提供了标准基础，但访问控制、保留策略和审计仍需由仓库及组织流程实现。

### 7. 部署准入

准入控制是把书面规范转成技术强制的关键位置。Kubernetes 官方文档明确指出 tag 可移动，而 digest 固定；按 digest 部署可以避免仓库标签变化导致运行版本漂移。生产策略可按以下顺序执行：

1. 镜像必须来自批准仓库。
2. 镜像引用必须包含 digest，禁止 `latest`。
3. digest 必须具有受信任身份的有效签名。
4. provenance 中的代码仓库、构建器和工作流必须在允许列表内。
5. 必须存在符合格式要求的 SBOM。
6. 漏洞结果必须在有效期内，并满足环境风险阈值。
7. 例外必须携带审批编号、责任人和失效时间。

Kyverno 的 `verifyImages` 规则可以要求签名、校验 digest，并把 tag 转换为 digest；Kubernetes 原生 `ImagePolicyWebhook` 也允许外部策略服务参与准入决策。无论使用哪种实现，生产策略都应默认拒绝无法验证的制品，并为策略服务不可用场景定义清晰的 fail-open 或 fail-closed 边界。核心生产环境通常采用 fail-closed，同时为紧急恢复准备受审计的 break-glass 流程。

### 8. 运行监测与退役

镜像通过准入不代表风险永久不变。运行阶段需要持续维护“digest—工作负载—集群—业务负责人”的映射，并把以下事件纳入告警：

- 当前运行 digest 新增严重漏洞或签名被撤销。
- 工作负载引用了未登记仓库、未批准 digest 或过期例外。
- 镜像实际运行配置与批准基线明显偏离。
- 仓库中出现异常推送、删除、跨命名空间复制或签名身份变化。

镜像退役应同步完成停止部署、删除引用、确认无运行实例、保留必要证据和按策略清理制品。涉及安全事件、审计或法规保留的镜像不能按普通垃圾回收策略删除。

## 分级策略：不同环境使用不同强度

| 控制项 | 开发环境 | 测试/预发 | 生产环境 |
|---|---|---|---|
| 镜像来源 | 允许公共镜像，经本地提示 | 仅批准仓库 | 仅生产仓库和批准命名空间 |
| 镜像标识 | 允许版本标签 | 记录标签与 digest | 强制 digest |
| 漏洞策略 | 提示高危和严重漏洞 | 严重漏洞阻断，高危需例外 | 严重漏洞阻断；高危按业务等级和可利用性决策 |
| SBOM | 建议生成 | 必须生成并归档 | 必须验证且与 digest 绑定 |
| 签名 | 可选 | 必须由 CI 身份签名 | 准入时验证身份、issuer 和 digest |
| Provenance | 记录构建信息 | 验证代码来源和构建器 | 强制受信任构建平台与发布工作流 |
| 例外 | 团队记录 | 安全审批和到期时间 | 双人审批、补偿控制、最短有效期 |
| 存量重扫 | 按需 | 每周或漏洞事件触发 | 每日或漏洞事件触发，并关联运行清单 |

分级不等于降低生产以外环境的基本安全要求。测试环境通常具有真实依赖和内部网络访问，仍需控制密钥、镜像来源和高风险漏洞。

## 组织规范：责任、时限与证据

镜像安全不能只由安全团队负责。建议明确以下责任边界：

- **平台团队**：维护构建平台、制品仓库、签名基础设施、准入控制和镜像清单。
- **研发团队**：维护 Dockerfile、依赖、基础镜像版本和应用漏洞修复。
- **安全团队**：制定风险阈值、例外规则、验证策略和审计要求。
- **运维/SRE**：维护运行映射、灰度、回滚、应急替换和退役流程。
- **业务负责人**：确认业务影响和例外风险接受，不代替技术修复责任。

规范中应给出可测量的服务水平，例如：严重且可利用漏洞在 24 小时内完成影响确认，在 72 小时内修复或实施补偿控制；高危例外最长 30 天；生产镜像扫描报告不得超过 24 小时；签名和 provenance 验证失败不得自动降级放行。

审计证据至少保留源代码提交、构建任务、镜像 digest、SBOM、provenance、扫描结果、签名验证结果、准入决策、部署清单和例外审批。只有这些对象能够通过 digest 串联，审计记录才具有可复核性。

## 实施顺序：先建立闭环，再提高门槛

镜像安全建设可以按四个阶段推进：

1. **建立资产账本**：统一仓库、命名规范、负责人、digest 和运行清单。
2. **建立可见性**：生成 SBOM、构建 provenance，执行入库扫描和存量重扫。
3. **建立可信发布**：由受控 CI 构建和签名，禁止个人账号直接推送生产仓库。
4. **建立强制准入**：按 digest 部署，验证签名、来源、SBOM 和风险阈值，逐步收紧例外。

不建议在资产清单缺失时直接启用大范围阻断。否则团队无法判断被阻断对象的责任人和业务影响，容易产生长期白名单。更稳妥的方法是先观察策略命中情况，修复基础数据和流程，再把稳定规则切换为强制模式。

## 验证方法

体系上线后应定期执行以下验证：

- 用未签名镜像、错误签名身份、移动标签和未知仓库验证准入是否阻断。
- 在测试镜像中放入模拟密钥和已知漏洞组件，确认扫描器、CI 和告警链路生效。
- 修改 tag 指向，确认生产仍按已批准 digest 运行。
- 撤销签名身份或使证明失效，确认存量监测能够定位运行实例。
- 随机抽取生产 Pod，从运行 digest 反查代码提交、构建记录、SBOM、扫描报告和审批记录。
- 演练基础镜像严重漏洞，测量从影响确认到批量重建、灰度、回滚的实际时间。

验证结果应进入改进清单。规则命中率、例外数量、例外逾期率、镜像平均修复时间、未知镜像数量和无法追溯 digest 数量，比单纯统计“扫描了多少镜像”更能反映管理成熟度。

## 结论

镜像安全管理的核心不是增加一个扫描工具，而是把镜像从“可被拉取的文件”转变为“具有身份、来源、组成、状态和责任人的不可变发布制品”。有效流程以 digest 贯穿构建、SBOM、provenance、扫描、签名、仓库、准入和运行清单；有效策略把高风险条件转换为自动阻断；有效规范则明确责任、时限、例外和证据。

当任一生产工作负载都能快速回答“运行的是什么、从哪里来、经过什么验证、出现问题由谁处理”，镜像管理才真正成为供应链安全控制，而不只是发布流水线中的一次扫描步骤。

## 参考资料

1. **NIST SP 800-190, Application Container Security Guide**，National Institute of Standards and Technology，2017-09，https://csrc.nist.gov/pubs/sp/800/190/final 。支持容器镜像、仓库、编排器、运行时和宿主机风险分类，以及全生命周期控制的必要性。
2. **NIST SP 800-218, Secure Software Development Framework (SSDF) Version 1.1**，National Institute of Standards and Technology，2022-02-03，https://csrc.nist.gov/pubs/sp/800/218/final 。支持把安全实践嵌入开发和发布流程、保护软件制品并保存来源证据的要求。
3. **OCI Image Format Specification**，Open Container Initiative，访问于 2026-07-13，https://github.com/opencontainers/image-spec/blob/main/spec.md 。支持镜像由 manifest、configuration、layers 和 content descriptor 构成，以及基于内容地址识别制品。
4. **OCI Distribution Specification**，Open Container Initiative，访问于 2026-07-13，https://github.com/opencontainers/distribution-spec/blob/main/spec.md 。支持 registry push/pull、manifest、blob、tag、digest、subject 和 referrers 的定义及内容完整性校验。
5. **SLSA Specification v1.2: Provenance**，SLSA / The Linux Foundation，访问于 2026-07-13，https://slsa.dev/spec/v1.2/provenance 。支持 provenance 用于描述制品在何处、何时、如何产生，并追溯构建输出到源代码。
6. **Signing Containers / Verifying Signatures**，Sigstore，访问于 2026-07-13，https://docs.sigstore.dev/cosign/signing/signing_with_containers/ 与 https://docs.sigstore.dev/cosign/verifying/verify/ 。支持 Cosign 容器签名、OIDC 身份验证以及签名载荷与镜像 digest 的绑定。
7. **Images**，Kubernetes Documentation，访问于 2026-07-13，https://kubernetes.io/docs/concepts/containers/images/ 。支持 tag 可移动、digest 不可变、生产避免 `latest`、按 digest 固定运行版本以及镜像拉取策略。
8. **Admission Control in Kubernetes**，Kubernetes Documentation，访问于 2026-07-13，https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/ 。支持 `AlwaysPullImages` 和 `ImagePolicyWebhook` 等部署准入机制及其安全边界。
9. **Verify Images Rules**，Kyverno Project，访问于 2026-07-13，https://kyverno.io/docs/policy-types/cluster-policy/verify-images/ 。支持以 `verifyImages` 校验签名、要求 digest、验证 attestation 并在准入阶段强制策略。该资料是具体实现文档，不作为通用规范来源。
10. **Container Image Scanning**，Trivy Project / Aqua Security，访问于 2026-07-13，https://trivy.dev/latest/docs/target/container_image/ 。支持对容器镜像执行漏洞、secret、license 和配置数据扫描。该资料用于示例命令，不作为风险阈值的规范依据。
