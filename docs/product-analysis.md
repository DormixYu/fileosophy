# Fileosophy 产品全面分析文档

> 分析日期：2026-06-01
> 技术栈：Tauri 2.x + React + TypeScript + Zustand + SQLite
> 定位：本地优先的桌面端项目管理与文件协作工具

---

## 一、完整功能清单

### 1.1 仪表盘（DashboardPage）
- **欢迎区**：显示用户头像 + 个性化问候语（"欢迎回来，XXX"）
- **统计卡片区**（可自定义，最多4张）：
  - 项目总数、活跃项目、本年已完成、已暂停
  - 本月新增、近7日更新、逾期项目、即将到期、无截止日期
  - 按项目类型分类的统计卡片（投标/项目/行政/学习/其他）
- **活跃项目网格**：显示最近更新的6个活跃项目卡片（3列布局）
- **近期活动时间线**：最近更新的5个项目的时间线视图
- **空状态引导**：无项目时引导创建第一个项目

### 1.2 项目列表（ProjectListPage）
- **新建项目**：弹窗表单（名称、描述、类型、状态、起止日期、创建人）
- **编辑项目**：复用同一弹窗组件
- **搜索**：支持按编号、名称、描述搜索
- **多维筛选**：
  - 状态多选筛选
  - 分类多选筛选
  - 日期范围筛选（起始/截止日期）
  - 筛选条件持久化（与甘特图页面共享同一筛选 key）
- **排序**：支持多列排序（升序/降序/取消排序）
- **可定制表格列**：列可见性、宽度可调、宽度持久化
- **批量操作**：
  - 多选（全选/反选/indeterminate 状态）
  - 批量修改状态
  - 批量删除（带确认弹窗和 toast 反馈）
- **项目操作**：
  - 双击项目打开系统文件夹
  - 分享项目（局域网共享）
  - 链接项目（加入他人共享）
  - 删除确认
- **链接项目弹窗**（JoinShareDialog）

### 1.3 项目详情（ProjectDetailPage）
- **三个标签视图**：项目详情 / 项目看板 / 项目甘特图（支持 URL 参数 `?tab=kanban|gantt`）
- **项目信息卡片**：
  - 名称、编号、分类、状态（带颜色徽标）
  - 开始/截止日期、状态变更时间、创建/更新时间
  - 创建人、项目描述
- **文件管理**：
  - 有 `folder_path` 时显示 FileExplorer（文件夹树）
  - 无 `folder_path` 时显示 FilePanel（上传文件列表）
- **项目文件夹快捷打开按钮**

### 1.4 看板（KanbanBoard — 项目详情子页面）
- **拖拽排序**：基于 @dnd-kit，支持卡片在列间拖拽
- **列管理**：添加列、编辑列名、删除列
- **卡片管理**：
  - 创建卡片（名称、描述、截止日期）
  - 编辑卡片（标题、描述、标签、截止日期）
  - 删除卡片（带确认）
  - 标签系统（逗号分隔输入）
- **甘特图联动**：
  - 创建卡片时可选同步甘特图（设置名称、开始日期、持续天数）
  - 编辑卡片时可关联/解除关联甘特图任务
  - 拖拽移动卡片后自动刷新甘特图
- **Todo 完成功能**：卡片可标记完成，自动移到 `todo_done` 列

### 1.5 甘特图（两个入口）

#### 全局甘特图（GanttPage）
- **项目级甘特图**：每个项目一行条形图
- **三级视图**：日视图 / 月视图 / 年视图（自动切换）
- **缩放**：Ctrl+滚轮缩放、底部工具栏切换
- **状态变更历史标记**：在甘特图上显示状态变更点（菱形标记）
- **里程碑标记**：在甘特图上显示项目里程碑（钻石标记）
- **搜索**：按项目名称/编号搜索
- **筛选**：状态筛选、分类筛选（与项目列表共享筛选持久化）
- **今天按钮**：快速滚动到当天位置
- **Tooltip**：悬停显示项目详情
- **点击交互**：点击项目跳转到详情页

#### 项目甘特图（GanttChart — 项目详情子页面）
- 任务级甘特图（同一个项目下的多个任务）

### 1.6 局域网共享（SharingPage）
- **本机共享**（Owner 模式）：
  - 选择文件夹 + 设置密码启动共享
  - 显示本机 IP + 端口
  - 一键复制连接地址
  - 连接客户端数量显示
  - 活动日志（上传/下载记录，5秒轮询）
  - 停止共享
- **加入他人共享**（Member 模式）：
  - 输入地址/密码连接
  - 局域网设备自动发现（Peer 发现）
  - 一键连接发现的设备
  - 保存连接（密码持久化）
  - 浏览远程文件
  - 导入远程项目到本地看板
  - 同步共享项目
  - 断开共享连接
- **远程文件浏览器**（RemoteFileBrowser 组件）
- **连接管理**：重连、断开、测试连接、迁移旧数据

### 1.7 设置（SettingsPage — 6 个标签页）
- **用户资料**：头像上传、用户名设置
- **通知设置**：10 种通知类型的开关偏好
- **项目配置**：
  - 项目状态自定义（名称、颜色、排序）
  - 项目类型自定义（名称、前缀、关键词）
  - 项目表格列配置（可见性、宽度）
  - 编号模板、文件夹模板
- **快捷键**：3 个全局快捷键配置
  - Cmd+Shift+N：新建项目
  - Cmd+Alt+S：显示/隐藏窗口
  - Cmd+Shift+F：全局搜索
- **数据管理**：
  - 导出单个项目（JSON/CSV，可选含文件）
  - 导出所有项目（JSON 完整备份）
  - 导入项目备份
  - 导出项目列表 CSV
  - 导出项目文件夹 ZIP
  - 从 CSV 导入项目列表
  - 文件夹扫描导入（从文件夹名推断项目信息）
- **关于**

### 1.8 全局搜索（GlobalSearch）
- 跨实体搜索：项目、卡片、甘特图任务、文件
- 键盘导航（上下箭头 + 回车）
- 200ms 防抖
- 搜索结果点击跳转到对应项目/看板/甘特图

### 1.9 通知系统（NotificationCenter）
- Toast 通知（本地触发）
- 通知历史（持久化到后端）
- 未读计数
- 标记已读 / 全部已读 / 清除历史
- 后端事件监听（app-notification、file-shared）
- 通知偏好设置

### 1.10 首次启动引导（OnboardingOverlay）
- 检测 `tutorial_completed` 设置项
- 引导完成后标记设置

### 1.11 文件管理

#### FilePanel（上传文件模式）
- 上传文件（支持多选）
- 文件列表（名称、大小、上传时间）
- 文件预览（内联预览：文本/代码/图片/Markdown）
- QuickLook 风格预览弹窗（上一张/下一张切换）
- 系统默认应用打开
- 局域网发送文件到其他实例
- 删除文件（带确认）

#### FileExplorer（文件夹树模式）
- 读取项目文件夹内容
- 树形结构展示（文件夹展开/折叠）
- 文件双击用系统应用打开
- 子项计数徽标

---

## 二、数据模型

### 2.1 实体关系图

```
Project (1) ──── (N) KanbanColumn
  │                     │
  │                     └── (N) KanbanCard ──── (0..1) GanttTask
  │
  ├── (N) GanttTask
  │         └── dependencies: number[] (自引用)
  │
  ├── (N) FileEntry
  │
  ├── (N) ProjectStatusHistory
  │
  └── (N) ProjectMilestone

User (单用户模式，全局唯一)

SharedConnection ──── SharedProject ──── Project (可选关联)

Notification (独立实体，带 link 字段可关联)

AppSettings (key-value 存储，承载所有配置)
```

### 2.2 实体字段详情

#### Project
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| name | string | 项目名称 |
| description | string? | 项目描述 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |
| project_number | string? | 项目编号（自动生成，格式如 TB-20240101-001） |
| project_type | string? | 分类 ID（tb/pj/xz/st/qt） |
| status | ProjectStatus? | 状态 |
| start_date | string? | 开始日期 |
| end_date | string? | 截止日期 |
| status_changed_at | string? | 状态变更时间 |
| created_by | string? | 创建人 |
| folder_path | string? | 关联文件夹路径 |

#### KanbanColumn
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| project_id | number | 所属项目 |
| title | string | 列标题 |
| position | number | 排序位置 |
| column_type | string? | 列类型（如 "todo_done"） |
| cards | KanbanCard[]? | 包含的卡片 |

#### KanbanCard
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| column_id | number | 所属列 |
| title | string | 卡片标题 |
| description | string? | 描述 |
| position | number | 排序位置 |
| tags | string[] | 标签数组 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |
| gantt_task_id | number? | 关联甘特图任务 |
| due_date | string? | 截止日期 |

#### GanttTask
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| project_id | number | 所属项目 |
| name | string | 任务名称 |
| start_date | string | 开始日期 |
| duration_days | number | 持续天数 |
| dependencies | number[] | 依赖任务 ID 数组 |
| progress | number | 进度（0-100） |
| created_at | string | 创建时间 |

#### FileEntry
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| project_id | number | 所属项目 |
| original_name | string | 原始文件名 |
| stored_name | string | 存储文件名 |
| size | number | 文件大小 |
| uploaded_at | string | 上传时间 |

#### User
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| name | string | 用户名 |
| avatar_path | string? | 头像路径 |
| created_at | string | 创建时间 |

#### Notification
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键（前端生成） |
| type | string | 通知类型 |
| title | string | 标题 |
| message | string | 消息 |
| read | boolean | 是否已读 |
| created_at | string | 创建时间 |
| link | string? | 关联链接 |

#### SharedConnection
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| addr | string | 地址（IP:端口） |
| label | string | 连接名称 |
| password | string? | 密码（列表接口不返回） |
| last_connected | string? | 最后连接时间 |
| last_path | string | 最后浏览路径 |
| created_at | string | 创建时间 |

#### SharedProject
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| local_project_id | number? | 关联本地项目 |
| remote_addr | string | 远程地址 |
| remote_root_path | string | 远程根路径 |
| remote_project_name | string | 远程项目名 |
| remote_owner | string | 远程所有者 |
| password | string | 连接密码 |
| role | "owner" \| "member" | 角色 |
| last_synced | string? | 最后同步时间 |
| status | "connected" \| "disconnected" | 连接状态 |
| created_at | string | 创建时间 |

---

## 三、用户流程图

### 3.1 主要导航结构

```
App
├── OnboardingOverlay (首次启动)
├── Layout (侧边栏 + 主内容)
│   ├── 侧边栏
│   │   ├── Logo + 搜索/通知按钮
│   │   ├── 导航菜单：概览 / 项目 / 甘特图 / 共享 / 设置
│   │   ├── 最近项目列表（前8个）
│   │   └── 用户区（点击跳转设置-用户资料）
│   │
│   └── Routes
│       ├── / → DashboardPage
│       ├── /projects → ProjectListPage
│       ├── /project/:id → ProjectDetailPage
│       │   ├── ?tab=detail → 项目详情 + 文件
│       │   ├── ?tab=kanban → 看板
│       │   └── ?tab=gantt → 项目甘特图
│       ├── /gantt → GanttPage
│       ├── /sharing → SharingPage
│       └── /settings → SettingsPage
│           ├── ?tab=profile
│           ├── ?tab=notifications
│           ├── ?tab=project
│           ├── ?tab=shortcuts
│           ├── ?tab=data
│           └── ?tab=about
│
└── GlobalSearch (模态层)
```

### 3.2 典型用户流程

#### 流程1：创建新项目
```
仪表盘/项目列表 → 点击"新建项目" → ProjectDialog 填写信息 → 
创建成功 → 项目出现在列表 → 点击进入详情 → 设置看板/甘特图/上传文件
```

#### 流程2：从文件夹导入项目
```
项目列表 → 数据管理设置 → 文件夹扫描 → 选择文件夹 → 
自动推断项目信息（名称、类型、日期）→ 确认导入
```

#### 流程3：局域网协作
```
A端：共享页面 → 新建共享 → 选择文件夹+设密码 → 启动
B端：共享页面 → 连接新共享/局域网设备发现 → 输入地址密码 → 
浏览远程文件 → 导入到看板 → 后续可同步
```

#### 流程4：项目管理日常工作流
```
仪表盘查看概览 → 进入项目详情 → 
看板拖拽任务 → 任务关联甘特图 → 
甘特图查看进度 → 状态变更 → 
活动时间线自动更新
```

---

## 四、状态管理架构（7个 Zustand Store）

| Store | 职责 |
|-------|------|
| useProjectStore | 项目 CRUD、当前项目、缓存策略（30秒内不重复拉取） |
| useSettingsStore | 应用设置、主题、快捷键注册/注销、解析后的状态/类型/列配置 |
| useNotificationStore | 通知历史、未读计数、通知偏好、Tauri 事件监听 |
| useKanbanStore | 看板板数据、列/卡 CRUD、拖拽移动 |
| useGanttStore | 甘特图任务 CRUD |
| useShareStore | 共享状态、连接管理、远程操作、Peer 发现 |
| useUserStore | 用户信息、头像上传 |

---

## 五、Tauri 后端 API 全景

### 5.1 项目管理（projectApi）
- `get_all_projects` / `get_project_by_id` / `create_project` / `update_project` / `delete_project`
- `open_folder` / `open_file`（系统原生操作）
- 状态变更历史 CRUD（4个 API）
- 里程碑 CRUD（4个 API）

### 5.2 看板（kanbanApi）
- `get_kanban_board` / `add_column` / `update_column` / `delete_column`
- `create_card` / `update_card` / `delete_card` / `move_card`
- `link_card_to_gantt` / `unlink_card_from_gantt` / `sync_gantt_to_kanban`

### 5.3 甘特图（ganttApi）
- `get_gantt_data` / `add_gantt_task` / `update_gantt_task` / `delete_gantt_task`

### 5.4 文件管理（fileApi）
- `list_project_files` / `upload_file_to_project` / `delete_file`
- `open_stored_file` / `preview_file`
- `share_file_over_network` / `discover_peers`
- `list_folder_contents`

### 5.5 局域网共享（shareApi）
- 共享服务：`start_folder_share` / `stop_folder_share` / `get_share_status`
- 客户端信息：`get_connected_clients` / `get_activity_log`
- 加入共享：`join_shared_folder` / `list_remote_files` / `download_remote_file` / `upload_remote_file`
- 连接管理：`get_shared_connections` / `save_shared_connection` / `delete_shared_connection` / `update_shared_connection` / `test_shared_connection`
- 共享项目：`get_shared_projects` / `import_shared_project` / `sync_shared_project` / `disconnect_shared_project` / `get_remote_project_info`
- 数据迁移：`migrate_legacy_connections`

### 5.6 设置（settingsApi）
- `get_app_settings` / `update_app_settings`

### 5.7 通知（notificationHistoryApi）
- `get_notifications` / `mark_notification_read` / `clear_notifications` / `mark_all_notifications_read`
- `get_notification_preferences` / `update_notification_preferences`

### 5.8 搜索（searchApi）
- `global_search`（跨项目/卡片/任务/文件搜索）

### 5.9 导入导出（exportApi）
- `export_project`（JSON/CSV）/ `export_all_projects` / `import_all_projects`
- `export_project_list` / `export_project_files` / `import_project_list`

### 5.10 文件夹扫描（folderApi）
- `scan_project_folders` / `import_project_from_folder`

### 5.11 用户（userApi）
- `get_current_user` / `create_or_update_user` / `upload_avatar`

### 5.12 系统（systemApi）
- `get_local_ip` / `convert_file_src` / `open_user_guide`

---

## 六、优势分析

### 6.1 做得好的方面

1. **设计系统一致**：统一使用 CSS 变量（`--gold`, `--bg-surface` 等），深色/浅色主题切换完善
2. **交互细节到位**：
   - 拖拽看板（@dnd-kit）
   - 可调列宽持久化
   - 筛选条件跨页面共享（ProjectListPage ↔ GanttPage）
   - 快捷键注册系统（全局快捷键 + 窗口切换）
3. **局域网共享功能完整**：从发现、连接、浏览、导入、同步到活动日志，形成了完整的协作闭环
4. **看板与甘特图深度联动**：卡片可关联甘特图任务，拖拽同步更新
5. **文件管理灵活**：同时支持上传文件模式（FilePanel）和文件夹树模式（FileExplorer）
6. **数据导入导出丰富**：JSON/CSV/ZIP 多种格式，支持文件夹扫描智能导入
7. **通知系统完善**：前后端事件联动，偏好可配置，历史可追溯
8. **首次引导体验**：OnboardingOverlay 检测 + 引导

### 6.2 当前痛点

1. **单用户架构限制**：User 实体是单用户模式，无法支持多人协作场景（虽然共享功能弥补了部分）
2. **项目编号自动生成逻辑不透明**：编号模板 `{prefix}-{date}-{sequence}` 的生成逻辑在前端看不到，可能在后端实现，但用户体验不够清晰
3. **大量内联样式**：DashboardPage 等页面大量使用 `style={}` 对象（834行中有200+行是样式对象），可维护性差
4. **筛选条件共享过于耦合**：ProjectListPage 和 GanttPage 通过 settings 存储同一个 `project_filters` key 共享筛选状态，虽然方便但耦合度过高，修改一个页面的筛选会影响另一个页面
5. **看板列类型硬编码**：`todo_done` 列类型在前端硬编码引用，缺乏灵活性
6. **甘特图性能隐患**：全局甘特图一次性加载所有项目+状态历史+里程碑，项目量大时可能有性能问题
7. **文件预览格式有限**：仅支持文本/代码/图片/Markdown，不支持 PDF、Office 文档等
8. **共享密码存储**：密码通过 `getConnectionPassword` API 获取，存在安全存储问题
9. **错误处理不统一**：部分 API 调用有 try-catch，部分没有；错误信息直接 `String(e)` 转换
10. **搜索结果无高亮**：全局搜索结果没有关键词高亮
11. **活动日志仅靠轮询**：Owner 共享的活动日志每5秒轮询，缺乏实时推送机制

### 6.3 缺失功能

1. **项目模板**：无法保存/复用项目模板（如固定看板列结构、默认甘特图任务）
2. **项目标签/分类增强**：仅有5种固定分类，无法动态添加
3. **任务指派**：单用户模型，无法将看板卡片指派给不同人
4. **时间追踪**：没有工时记录/时间追踪功能
5. **文件版本管理**：上传同名文件直接覆盖，无版本历史
6. **批量导入文件**：无拖拽上传、无批量选择文件夹导入
7. **项目日历视图**：仅有甘特图，无日历视图查看到期任务
8. **数据统计图表**：Dashboard 仅有数字统计，无趋势图/饼图等可视化
9. **回收站**：删除项目/文件后无法恢复
10. **离线/在线状态指示**：共享页面的连接状态管理较粗糙
11. **国际化**：虽然设置有 language 字段，但 UI 全部硬编码中文
12. **拖拽上传文件**：FilePanel 不支持拖拽到窗口上传
13. **项目评论/讨论**：无项目内的文字讨论功能
14. **附件与卡片关联**：看板卡片无法直接附加文件
15. **自动保存**：编辑表单无自动保存/草稿功能

---

## 七、技术架构总结

```
┌─────────────────────────────────────────────────┐
│                  React 前端                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 6 Pages  │ │Components│ │ 7 Zustand Stores │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│                    │                              │
│              tauri-api.ts (统一 API 层)           │
│                    │                              │
│           @tauri-apps/api invoke                 │
├─────────────────────────────────────────────────┤
│                Tauri 2.x 后端 (Rust)             │
│           SQLite 数据库 + 文件存储                 │
│           网络共享服务 + Peer 发现                 │
│           全局快捷键 + 系统对话框                   │
└─────────────────────────────────────────────────┘
```

**关键设计决策**：
- 所有状态通过 Zustand 管理，API 调用统一在 `tauri-api.ts` 中
- 设置采用 key-value 模式，灵活存储各种配置（包括 JSON 序列化的复杂结构）
- 筛选/列配置等 UI 状态持久化到后端设置表，实现跨会话保持
- 共享功能基于 TCP 直连（非 WebRTC），适合局域网场景
