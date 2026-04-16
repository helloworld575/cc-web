export type Locale = 'en' | 'zh';

export const translations = {
  en: {
    // Nav
    home: 'Home',
    blog: 'Blog',
    tools: 'Tools',
    files: 'Files',
    admin: 'Admin',
    login: 'Login',
    logout: 'Logout',

    // Home
    homeTitle: "ThomasLee's Blog",
    homeDesc: 'Tech, tools, and thoughts — welcome to my corner of the internet.',

    // Blog
    blogTitle: 'Blog',
    searchPlaceholder: 'Search...',
    noPosts: 'No posts found.',
    readMore: 'Read more',
    loading: 'Loading...',
    postNotFound: 'Post not found.',

    // Tools / Todos
    toolsTitle: 'Todos',
    newTodoPlaceholder: 'New todo...',
    add: 'Add',
    all: 'All',
    pending: 'Pending',
    done: 'Done',
    noTodos: 'No todos yet.',

    // Files
    filesTitle: 'Files',
    uploadHint: 'Click or drag & drop images here (multiple supported)',
    uploading: 'Uploading...',

    // Login
    loginTitle: 'Login',
    passwordPlaceholder: 'Password',
    loginBtn: 'Login',
    loginError: 'Invalid password',

    // Blog post
    backToBlog: '← Back to Blog',
    publishedOn: 'Published on',

    // Pagination
    prev: 'Prev',
    next: 'Next',

    // Date filter
    dateFrom: 'From',
    dateTo: 'To',
    dateReset: 'Clear',
    diary: 'Diary',
    bazi: 'Fortune',

    // Deadline
    deadline: 'Deadline',
    deadlinePlaceholder: 'Set deadline (optional)',
    deadlineOverdue: 'Overdue',
    deadlineToday: 'Due today',
    deadlineTomorrow: 'Due tomorrow',
    deadlineSoon: 'Due soon',
    deadlineAlertTitle: 'Upcoming Deadlines',

    // Admin — shared
    edit: 'Edit',
    view: 'View',
    delete: 'Delete',
    del: 'Del',
    save: 'Save',
    saved: 'Saved!',
    search: 'Search',

    // Admin — blog list
    adminBlog: 'Blog Posts',
    newPostPlaceholder: 'New post title…',
    newPost: '+ New',
    colTitle: 'Title',
    colDate: 'Date',
    colActions: 'Actions',

    // Admin — blog editor
    briefPlaceholder: 'Brief / excerpt (shown on blog list page)',
    aiTools: 'AI Tools',
    appendToArticle: 'Append to article',
    clickToApplyTitle: 'Click to apply title:',
    clickToCopyTag: 'Click to copy tag:',
    writeContentFirst: 'Write some content first',

    // Admin — files
    adminFiles: 'Admin — Files',
    albums: 'Albums',
    newAlbum: 'New Album',
    allPhotos: 'All Photos',
    moveToAlbum: 'Move to Album',
    removeFromAlbum: 'Remove from Album',
    albumName: 'Album Name',
    noAlbum: 'Uncategorized',
    deleteAlbumConfirm: 'Delete this album? Photos will not be deleted.',

    // Admin — todos
    adminTodos: 'Admin — Todos',
    newTodo: 'New todo',

    // Markdown editor
    write: 'Write',
    preview: 'Preview',
    markdownPlaceholder: 'Write markdown here...',

    // Fortune history
    fortuneHistory: 'History',
    fortuneReading: 'Reading',
    fortuneNoHistory: 'No readings yet.',
    fortuneDeleteConfirm: 'Delete this reading?',
    fortuneDeleted: 'Deleted',
    fortuneSaved: 'Saved to history',
    fortuneViewFull: 'View full analysis',
    fortuneBack: 'Back to list',

    // AI Chat
    aiChat: 'AI Chat',
    aiChatNoProvider: 'No AI provider configured.',
    aiChatGoConfig: 'Go to Admin → AI Config to add one',
    aiChatNew: 'New Chat',
    aiChatWelcome: 'Start a conversation',
    aiChatWelcomeDesc: 'Select a provider and type a message to begin.',
    aiChatPlaceholder: 'Type a message... (Shift+Enter for new line)',
    aiChatSend: 'Send',
    aiChatStop: 'Stop',

    // Subscriptions
    subscriptions: 'Subscriptions',
    subscriptionBriefs: 'briefs',
    subscriptionNoBriefs: 'No briefs yet. Add subscriptions to get started.',
    subscriptionGoConfig: 'Go to Admin → Subscriptions to add sources',
    subscriptionRefresh: 'Refresh All',
    subscriptionRefreshing: 'Refreshing...',
    subscriptionDeleteConfirm: 'Delete this brief?',
  },
  zh: {
    // Nav
    home: '首页',
    blog: '博客',
    tools: '工具',
    files: '文件',
    admin: '管理',
    login: '登录',
    logout: '退出',

    // Home
    homeTitle: 'ThomasLee 的博客',
    homeDesc: '技术、工具与随想 — 欢迎来到我的小站。',

    // Blog
    blogTitle: '博客',
    searchPlaceholder: '搜索...',
    noPosts: '没有找到文章。',
    readMore: '阅读更多',
    loading: '加载中...',
    postNotFound: '文章不存在。',

    // Tools / Todos
    toolsTitle: '待办事项',
    newTodoPlaceholder: '新建待办...',
    add: '添加',
    all: '全部',
    pending: '待完成',
    done: '已完成',
    noTodos: '暂无待办。',

    // Files
    filesTitle: '文件',
    uploadHint: '点击或拖放图片到此处（支持多选）',
    uploading: '上传中...',

    // Login
    loginTitle: '登录',
    passwordPlaceholder: '密码',
    loginBtn: '登录',
    loginError: '密码错误',

    // Blog post
    backToBlog: '← 返回博客',
    publishedOn: '发布于',

    // Pagination
    prev: '上一页',
    next: '下一页',

    // Date filter
    dateFrom: '从',
    dateTo: '到',
    dateReset: '清除',
    diary: '日记',
    bazi: '算命',

    // Deadline
    deadline: '截止日期',
    deadlinePlaceholder: '设置截止日期（可选）',
    deadlineOverdue: '已逾期',
    deadlineToday: '今天到期',
    deadlineTomorrow: '明天到期',
    deadlineSoon: '即将到期',
    deadlineAlertTitle: '即将到期的任务',

    // Admin — shared
    edit: '编辑',
    view: '查看',
    delete: '删除',
    del: '删',
    save: '保存',
    saved: '已保存！',
    search: '搜索',

    // Admin — blog list
    adminBlog: '博客文章',
    newPostPlaceholder: '新文章标题…',
    newPost: '+ 新建',
    colTitle: '标题',
    colDate: '日期',
    colActions: '操作',

    // Admin — blog editor
    briefPlaceholder: '摘要 / 简介（显示在博客列表页）',
    aiTools: 'AI 工具',
    appendToArticle: '追加到文章末尾',
    clickToApplyTitle: '点击应用标题：',
    clickToCopyTag: '点击复制标签：',
    writeContentFirst: '请先写一些内容',

    // Admin — files
    adminFiles: '管理 — 文件',
    albums: '相册',
    newAlbum: '新建相册',
    allPhotos: '全部照片',
    moveToAlbum: '移入相册',
    removeFromAlbum: '移出相册',
    albumName: '相册名称',
    noAlbum: '未分类',
    deleteAlbumConfirm: '确认删除此相册？照片不会被删除。',

    // Admin — todos
    adminTodos: '管理 — 待办事项',
    newTodo: '新建待办',

    // Markdown editor
    write: '编写',
    preview: '预览',
    markdownPlaceholder: '在此写 Markdown...',

    // Fortune history
    fortuneHistory: '历史记录',
    fortuneReading: '解读',
    fortuneNoHistory: '暂无记录。',
    fortuneDeleteConfirm: '确定删除此记录？',
    fortuneDeleted: '已删除',
    fortuneSaved: '已保存到历史',
    fortuneViewFull: '查看完整分析',
    fortuneBack: '返回列表',

    // AI Chat
    aiChat: 'AI 对话',
    aiChatNoProvider: '尚未配置 AI 服务商。',
    aiChatGoConfig: '前往管理后台 → AI 配置 添加',
    aiChatNew: '新对话',
    aiChatWelcome: '开始对话',
    aiChatWelcomeDesc: '选择服务商，输入消息开始聊天。',
    aiChatPlaceholder: '输入消息... (Shift+Enter 换行)',
    aiChatSend: '发送',
    aiChatStop: '停止',

    // Subscriptions
    subscriptions: '订阅',
    subscriptionBriefs: '条摘要',
    subscriptionNoBriefs: '暂无摘要。添加订阅源开始使用。',
    subscriptionGoConfig: '前往管理后台 → 订阅 添加源',
    subscriptionRefresh: '全部刷新',
    subscriptionRefreshing: '刷新中...',
    subscriptionDeleteConfirm: '确定删除此摘要？',
  },
} satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof typeof translations.en;
